const ARG_PREFIX    = '--';
const ARG_SEPARATOR = '=';

const processArguments = process.argv.slice( 2 );

/**
 * @param {string} argToCheck Name of argument, without '--' prefix
 */
export function hasProcessArgument( argToCheck ) {
    return processArguments.some( arg => arg.substring( ARG_PREFIX.length ) === argToCheck );
}

/**
 * @param {string} argToGet
 * @returns {string | undefined}
 */
export function getProcessArgumentValue( argToGet ) {
    for ( const arg of processArguments ) {
        if ( !arg.startsWith( ARG_PREFIX ) )
            continue;

        const segments = arg.substring( ARG_PREFIX.length ).split( ARG_SEPARATOR );
        if ( segments.length !== 2 )
            continue;

        if ( segments[ 0 ] === argToGet )
            return segments[ 1 ];
    }
    return undefined;
}