import { exec, spawn } from 'child_process';
import { Logger }      from './logging';

/**
 * Performs a command and returns a promise with the result, or worse, an error...
 */
export async function execPromise( command: string ): Promise<[ string | null, Error | null ]> {
    return new Promise( ( resolve ) =>
                            exec( command, ( error: Error | null, stdout: string | null ) =>
                                resolve( [ stdout, error ] ) ) );
}

/**
 * Executes the given NPM script
 */
export function npmRun( script: string, env: NodeJS.ProcessEnv, npmPath: string, cwd: string, silenced: boolean | ( ( input: string ) => boolean ) = false ): Promise<number> {
    return new Promise( ( resolve ) => {

        Logger.log( `Executing script \x1b[34m${ script }\x1b[0m` );
        const process = spawn( npmPath, [ 'run', script ], { cwd, env } );

        process.stdout.on( 'data', ( data: any ) => {
            const parsed = data.toString();
            if ( !( typeof silenced === 'function' ? silenced( parsed ) : silenced ) )
                Logger.format( console.debug, script, process.pid!, parsed );
        } );
        process.stderr.on( 'data', ( data: any ) => {
            const parsed = data.toString();
            if ( !( typeof silenced === 'function' ? silenced( parsed ) : silenced ) )
                Logger.format( console.error, script, process.pid!, parsed );
        } );
        process.on( 'close', ( code: number ) => {
            if ( !silenced ) Logger.format( console.debug, script, process.pid!, `Process exited with code ${ code }` );
            resolve( code );
        } );
    } );
}

export function scheduleTasks<T>( tasks: ( ( ...params: any[] ) => T )[], delay: number = 0 ): Promise<T[]> {
    return new Promise( ( resolve ) => {
        setTimeout( () => {
            Promise.all( tasks.map( task => task() ) ).then( resolve );
        }, delay );
    } );
}