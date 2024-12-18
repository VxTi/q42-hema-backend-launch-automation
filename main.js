/**
 * macOS-only script for automatically launching the backend application.
 * This script authenticates the user with AWS, sets up everything and synchronizes with the
 * HEMA database.
 *
 * Before using this script, you'll have to enable `AWS SSO`. This can be done by doing the following steps:
 * - run `aws configure sso --use-device-code`
 * - set:
 *  `start url`           -> `https://hema-digital.awsapps.com/start/#`
 *  `region`              -> `eu-central-1`
 *  `output type`         -> `json`
 *  `registration scopes` -> `sso:account:access`
 *
 *  Flags you can present with this script:
 *
 * `--aws-profile=<AWS PROFILE NAME>` - This flag forces the script to use this AWS SSO profile. If left blank, the
 * script  will automatically use the first profile it finds.
 *
 * `--skip-setup` - This flag forces the script to just authenticate with AWS, without building TS models.
 * This  makes the launching way faster, though a little more prone to errors.
 *
 * `--update` - This updates the git branch of the project.
 *
 * `--no-sync` - Prevent content sync. This can take up time, and is not always necessary.
 */

import { getProcessArgumentValue, hasProcessArgument } from './pargs.js';
import { execPromise, npmRun, schedule } from './execution';
import { Logger }                        from './logging.js';
import { existsSync, readFileSync }      from 'fs';
import { join }                                        from 'path';

/* -- -- -- -- -- -- -- -- -- -- -- -- Update path accordingly -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- */
/*                                                                                                          */
let projectPath = join( process.env.HOME, '/Projects/Work/experience-customerapp-backend' );
/*                                                                                                          */
/* -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- */

const args = process.argv.slice( 2 );

const awsProfile    = getProcessArgumentValue( 'aws-profile' );
const fastSetup     = hasProcessArgument( 'skip-setup' );
const noSync        = hasProcessArgument( 'no-sync' );
const updateGit     = hasProcessArgument( 'update' );

/**
 * Exits the program if an error occurs, which is if the `error` parameter is truthy.
 * @param {Error | undefined | boolean} error
 * @param {string} message The message to show as error message.
 */
function exitUponError( error, message ) {
    if ( error ) {
        Logger.error( error, message );
        process.exit( 1 );
    }
}

/*
 * Main entry of script.
 */
( async () => {
    // Get NPM path
    const [ npm, err ] = await execPromise( 'whereis npm' );
    exitUponError( err, 'Failed to resolve npm path' );

    const npmPath = npm.split( ' ' )[ 1 ];

    const awsConfigPath = join( process.env.HOME, '.aws/config' );

    // Check whether user has AWS SSO enabled
    exitUponError( !existsSync( awsConfigPath ), 'Unable to locate aws config file. Configure AWS SSO before launching the debugger.' );

    // Ensure sso profile exists
    const configContent = readFileSync( awsConfigPath, { encoding: 'utf8' } );
    const profile       = awsProfile ?? /\[profile (.+)]/g.exec( configContent )?.[ 1 ];

    if ( !profile ) {
        Logger.error( `No AWS SSO session found. Create one by executing the following command:\naws sso configure --use-device-code\nstart url = https://hema-digital.awsapps.com/start/#\nregion = eu-central-1\noutput = json\nregistration scopes = sso:account:access` );
        process.exit( 1 );
    }

    // Authenticate profile
    Logger.log( `Authorizing with SSO profile \x1b[34m${ profile }\x1b[0m` );
    await execPromise( `aws sso login --profile ${ profile }` );
    Logger.log( 'Authenticated with SSO.' );

    const [ awsEnv, awsEnvErr ] = await execPromise( `aws configure export-credentials --profile ${ profile } --format env` );
    exitUponError( awsEnvErr, 'Failed to acquire environment variables from AWS.' );

    const env = {};
    Object.assign( env, process.env );

    const awsKeys = [ 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN' ];
    awsEnv.split( '\n' ).forEach( line => {
        awsKeys.forEach( ( key ) => {
            const regex = new RegExp( `export ${key}=([^"]+)`, 'g' );
            const match = regex.exec( line )?.[ 1 ];
            if ( match ) Object.assign( env, { [ key ]: match } );
        } );
    } );

    if ( updateGit ) {
        Logger.log( 'Updating git repository...' );
        await execPromise( `cd ${ projectPath } && git pull` );
    }

    if ( !projectPath ) {
        Logger.log( 'Project path not declared, attempting to find...' );
        const [ foundPath, errf ] = await execPromise( 'find / -type d -name \'experience-customerapp-backend\' -not -path "*/.*" -not "*/Library/*" -not "*/System/*" -prune -print -quit' );
        exitUponError( errf, 'Failed to locate project path.' );
        projectPath = foundPath;
    }

    let muted     = true;
    const mutedFn = () => muted;

    Logger.log( fastSetup ? 'Authorizing with AWS credentials...' : 'Setting up environment...' );
    await npmRun( fastSetup ? 'ca:login' : 'setup', env, projectPath, npmPath, mutedFn );
    Logger.log( `Finished ${ fastSetup ? 'authorizing' : 'setup' }, starting server script...` );

    npmRun( 'dev:express', env, npmPath, projectPath, mutedFn );

    schedule(
        [
            () => fetch( 'http://localhost:3000/events/store-system-token' ),
            () => !noSync && fetch( 'http://localhost:3000/events/content-sync' ),
        ], 7000
    ).then( _ => {
        muted = false;
        Logger.log( 'Done.' );
    } );
} )().catch( err => exitUponError( err, `An error occurred whilst attempting to debug the application: ${err.message}` ) );