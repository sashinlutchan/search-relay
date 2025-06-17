import { createLogger, format, transports } from 'winston'

const { combine, timestamp, errors, json } = format

const createWinstonLogger = () => {
   return createLogger({
      level: 'info',
      format: combine(
         timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
         errors({ stack: true }),
         json(),
      ),
      transports: [
         new transports.Console({
            format: format.combine(format.colorize(), format.simple()),
         }),
      ],
   })
}

let winstonLogger: any = null

export const logger = {
   error: (message: string, meta?: any) => {
      if (!winstonLogger) winstonLogger = createWinstonLogger()
      winstonLogger.error(message, meta)
   },
   info: (message: string, meta?: any) => {
      if (!winstonLogger) winstonLogger = createWinstonLogger()
      winstonLogger.info(message, meta)
   },
   warn: (message: string, meta?: any) => {
      if (!winstonLogger) winstonLogger = createWinstonLogger()
      winstonLogger.warn(message, meta)
   },
   debug: (message: string, meta?: any) => {
      if (!winstonLogger) winstonLogger = createWinstonLogger()
      winstonLogger.debug(message, meta)
   },
   verbose: (message: string, meta?: any) => {
      if (!winstonLogger) winstonLogger = createWinstonLogger()
      winstonLogger.verbose(message, meta)
   },
   silly: (message: string, meta?: any) => {
      if (!winstonLogger) winstonLogger = createWinstonLogger()
      winstonLogger.silly(message, meta)
   },
   log: (level: string, message: string, meta?: any) => {
      if (!winstonLogger) winstonLogger = createWinstonLogger()
      winstonLogger.log(level, message, meta)
   },
   child: (options: Object) => {
      if (!winstonLogger) winstonLogger = createWinstonLogger()
      return winstonLogger.child(options)
   },
}
