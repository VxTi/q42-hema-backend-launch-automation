import { exec, spawn } from 'child_process';
import { Logger }      from './logging.js';

/**
 * Performs a command and returns a promise with the result, or worse, an error...
 * @returns {Promise<[string | undefined, Error | undefined]>} The promise containing the result, or an error.
 */
export async function execPromise( command ) {
    return new Promise( ( resolve ) => exec( command, ( error, stdout ) => resolve( [ stdout, error ] ) ) );
}

/**
 * Executes the given NPM script
 * @param {string} script The script to run in the project path.
 * @param {NodeJS.ProcessEnv} env Process environment variables.
 * @param {string} npmPath The path to the NPM executable
 * @param {string} cwd The current working directory of the script.
 * @param {boolean | ((input: string) => boolean)} silenced Whether IO is silenced. False by default.
 * @returns {Promise<number | null>} Exit code of the script.
 */
export function npmRun( script, env, npmPath,cwd,  silenced = false ) {
    return new Promise( ( resolve ) => {

        Logger.log( `Executing script \x1b[34m${ script }\x1b[0m` );
        const process = spawn( npmPath, [ 'run', script ], { cwd, env } );

        process.stdout.on( 'data', ( data ) => {
            const parsed = data.toString();
            if ( !( typeof silenced === 'function' ? silenced( parsed ) : silenced ) )
                Logger.format( console.debug, script, process.pid, parsed );
        } );
        process.stderr.on( 'data', ( data ) => {
            const parsed = data.toString();
            if ( !( typeof silenced === 'function' ? silenced( parsed ) : silenced ) )
                Logger.format( console.error, script, process.pid, parsed );
        } );
        process.on( 'close', ( code ) => {
            if ( !silenced ) Logger.format( console.debug, script, process.pid, `Process exited with code ${ code }` );
            resolve( code );
        } );
    } );
}

/**
 * @param {(() => ((...params: any[]) => Promise<any>))[]} tasks
 * @param {number} [delay]
 * @returns {Promise<unknown>}
 */
export function schedule( tasks, delay = 0 ) {
    return new Promise( ( resolve ) => {
        setTimeout( () => {
            Promise.all( tasks.map( task => task()() ) ).then( resolve );
        }, delay );
    } );
}