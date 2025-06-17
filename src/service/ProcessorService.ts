import { SearchParams } from '../types'

export interface ProcessorService {
   process(event: any): Promise<void>
   search<T>(tableName: string, params: SearchParams): Promise<T[]>
   purge(): Promise<void>
   delete(tableName: string, id: string): Promise<void>
}
