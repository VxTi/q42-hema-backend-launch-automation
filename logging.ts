// Very self-explanatory.


export const Logger = {
    format: ( messageFn: (...data: any[]) => void, script: string, pid: number, message: string ) =>
                messageFn( `[${ new Date().toISOString() }] [\x1b[34m${ pid }\x1b[0m] [\x1b[34m${ script }\x1b[0m] ${ message }` ),
    log:    ( message: string ) => Logger.format( console.debug, 'SYS', process.pid, message ),
    error:  ( message: string ) => Logger.format( console.error, 'ERROR', process.pid, message )
};