// Very self-explanatory.

export const Logger = {
    format: ( messageFn, script, pid, message ) => messageFn( `[${ new Date().toUTCString() }] [\x1b[34m${ pid }\x1b[0m] [\x1b[34m${ script }\x1b[0m] ${ message }` ),
    log:    ( message ) => Logger.format( console.debug, 'SYS', process.pid, message ),
    error:  ( message ) => Logger.format( console.error, 'ERROR', process.pid, message )
};