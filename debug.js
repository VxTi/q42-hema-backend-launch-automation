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
 * `--profile=<AWS PROFILE NAME>` - This flag forces the script to use this AWS SSO profile. If left blank, the script
 * will automatically use the first profile it finds.
 *
 * `--fast` - This flag forces the script to just authenticate with AWS, without building TS models. This makes the
 * launching way faster, though a little more prone to errors.
 *
 * `--update` - This updates the git branch of the project.
 *
 * `--nosync` - Prevent content sync. This can take up time, and is not always necessary.
 */

const { spawn, exec } = require( 'child_process' );
const { join }        = require( 'path' );
const fs              = require( 'fs' );

/* -- -- -- -- -- -- -- -- -- -- -- -- Update path accordingly -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- */
/*                                                                                                          */
/**/  let projectPath = join( process.env.HOME, '/Projects/Work/experience-customerapp-backend' );        /**/
/*                                                                                                          */
/* -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- */

const args = process.argv.slice( 2 );

/** @type {string | undefined} */
const awsProfile = args.find( arg => arg.startsWith( '--profile=' ) )?.split( '=' )?.[ 1 ];
const fastSetup  = args.findIndex( arg => arg === '--fast' ) > -1;
const noSync     = args.findIndex( arg => arg === '--nosync' ) > -1;

// Whether to update the projects git branch
const updateGit = args.findIndex( arg => arg === '--update' ) > -1;

/**
 * Performs a command and returns a promise with the result, or worse, an error...
 * @returns {Promise<[string | undefined, Error | undefined]>} The promise containing the result, or an error.
 */
async function execPromise( command ) {
    return new Promise( ( resolve ) => exec( command, ( error, stdout ) => resolve( [ stdout, error ] ) ) );
}

const Logger = {
    format: ( messageFn, script, pid, message ) => messageFn( `[${ new Date().toUTCString() }] [\x1b[34m${ pid }\x1b[0m] [\x1b[34m${ script }\x1b[0m] ${ message }` ),
    log:    ( message ) => Logger.format( console.debug, 'SYS', process.pid, message ),
    error:  ( message ) => Logger.format( console.error, 'ERROR', process.pid, message )
};

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

/**
 * Executes the given NPM script
 * @param {string} script The script to run in the project path.
 * @param {NodeJS.ProcessEnv} env Process environment variables.
 * @param {string} npmPath The path to the NPM executable
 * @param {boolean | ((input: string) => boolean)} silenced Whether IO is silenced. False by default.
 * @returns {Promise<number | null>} Exit code of the script.
 */
function npmRun( script, env, npmPath, silenced = false ) {
    return new Promise( ( resolve ) => {

        Logger.log( `Executing script \x1b[34m${ script }\x1b[0m` );
        const process = spawn( npmPath, [ 'run', script ], { cwd: projectPath, env } );

        process.stdout.on( 'data', ( data ) => {
            const parsed = data.toString();
            if ( !(typeof silenced === 'function' ? silenced( parsed ) : silenced) )
                Logger.format(console.debug, script, process.pid, parsed);
        } );
        process.stderr.on( 'data', ( data ) => {
            const parsed = data.toString();
            if ( !(typeof silenced === 'function' ? silenced( parsed ) : silenced) )
                Logger.format(console.error, script, process.pid, parsed);
        } );
        process.on( 'close', ( code ) => {
            if ( !silenced ) Logger.format( console.debug, script, process.pid, `Process exited with code ${ code }` );
            resolve( code );
        } );
    } );
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
    exitUponError( !fs.existsSync( awsConfigPath ), 'Unable to locate aws config file. Configure AWS SSO before launching the debugger.' );

    // Ensure sso profile exists
    const configContent = fs.readFileSync( awsConfigPath, { encoding: 'utf8' } );
    const profile       = awsProfile ?? /\[profile (.+)]/g.exec( configContent )?.[ 1 ];

    if ( !profile ) {
        Logger.error( 'No AWS SSO session found. Create one by executing the following command:' );
        Logger.error( '`aws sso configure --use-device-code`\nstart url = https://hema-digital.awsapps.com/start/#\nregion = eu-central-1\noutput = json\nregistration scopes = sso:account:access' );
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

    if ( ! projectPath ) {
        Logger.log("Project path not declared, attempting to find...");
        const [ foundPath, errf] = await execPromise('find / -type d -name \'experience-customerapp-backend\' -not -path "*/.*" -not "*/Library/*" -not "*/System/*" -prune -print -quit');
        exitUponError(errf, "Failed to locate project path.");
        projectPath = foundPath;
    }

    let muted = true;
    const mutedFn = () => muted;

    Logger.log( fastSetup ? 'Authorizing with AWS credentials...' : 'Setting up environment...' );
    await npmRun( fastSetup ? 'ca:login' : 'setup', env, npmPath, mutedFn );
    Logger.log( `Finished ${ fastSetup ? 'authorizing' : 'setup' }, starting server script...` );

    npmRun( 'dev:express', env, npmPath, mutedFn );

    setTimeout( async () => {
        Logger.log( 'Storing system and synchronizing content...' );
        await fetch( 'http://localhost:3000/events/store-system-token' );
        if ( !noSync )
            await fetch( 'http://localhost:3000/events/content-sync' );
        Logger.log( 'Done.' );
        muted = false;
    }, 7000 );
} )();