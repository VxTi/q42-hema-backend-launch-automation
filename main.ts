import { getProcessArgumentValue, hasProcessArgument } from './pargs';
import { execPromise, npmRun, scheduleTasks }          from './execution';
import { Logger }                                      from './logging';
import { existsSync, readFileSync }                    from 'fs';
import { join }                                        from 'path';

/* -- -- -- -- -- -- -- -- -- -- -- -- Update path accordingly -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- */
/*                                                                                                          */
let projectPath: string | undefined = getProcessArgumentValue('path');
//join( process.env.HOME!, '/Projects/Work/experience-customerapp-backend' ); <- you can do this too, is way faster.
/*                                                                                                          */
/* -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- */

const args: string[] = process.argv.slice( 2 );

const awsProfile: string | undefined = getProcessArgumentValue( 'aws-profile' );
const fastSetup: boolean             = hasProcessArgument( 'skip-setup' );
const noSync: boolean                = hasProcessArgument( 'no-sync' );
const updateGit: boolean             = hasProcessArgument( 'update' );
const verbose: boolean               = hasProcessArgument( 'verbose' );

/**
 * Exits the program if an error occurs, which is if the `error` parameter is truthy.
 */
function exitUponError( error: any, message: string ) {
    if ( !error )
        return;
    Logger.error( message );
    process.exit( 1 );
}

/*
 * Main entry of script.
 */
( async () => {
    // Get NPM path
    const [ npm, err ] = await execPromise( 'whereis npm' );
    exitUponError( err, 'Failed to resolve npm path' );

    const npmPath = npm!.split( ' ' )[ 1 ];

    const awsConfigPath = join( process.env.HOME!, '.aws/config' );

    // Check whether user has AWS SSO enabled
    exitUponError( !existsSync( awsConfigPath ), 'Unable to locate aws config file. Configure AWS SSO before launching the debugger.' );

    // Ensure sso profile exists
    const configContent: string       = readFileSync( awsConfigPath, { encoding: 'utf8' } );
    const profile: string | undefined = awsProfile ?? /\[profile (.+)]/g.exec( configContent )?.[ 1 ];

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

    const env: NodeJS.ProcessEnv = {};
    Object.assign( env, process.env );

    const awsKeys: string[] = [ 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN' ];

    awsEnv?.split( '\n' ).forEach( line => {
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
        const [ foundPath, errf ] = await execPromise( 'find ~ -type d -name \'experience-customerapp-backend\' -not' +
                                                       ' -path "*/.*" -not "*/Library/*" -not "*/System/*" -prune -print -quit' );
        exitUponError( errf, 'Failed to locate project path.' );
        projectPath = foundPath!;
    }

    let muted     = !verbose;
    const shouldLoggingBeMuted = () => muted;

    Logger.log( fastSetup ? 'Authorizing with AWS credentials...' : 'Setting up environment...' );
    await npmRun( fastSetup ? 'ca:login' : 'setup', env, npmPath, projectPath, shouldLoggingBeMuted );
    Logger.log( `Finished ${ fastSetup ? 'authorizing' : 'setup' }, starting server script...` );

    npmRun( 'dev:express', env, npmPath, projectPath, shouldLoggingBeMuted );

    scheduleTasks<void>(
        [
            () => {
                fetch( 'http://localhost:3000/events/store-system-token' );
            },
            () => {
                !noSync && fetch( 'http://localhost:3000/events/content-sync' );
            }
        ], 7000
    ).then( _ => {
        muted = false;
        Logger.log( 'Done.' );
    } );
} )()
    .catch( err => exitUponError( err, `An error occurred whilst attempting to debug the application: ${ err.message }` ) );