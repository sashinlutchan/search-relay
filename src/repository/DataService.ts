import { SearchParams } from '../types'

export interface DataService {
   create(tableName: string, id: string, data: object): Promise<boolean>
   get<T>(tableName: string, id: string): Promise<T>
   search<T>(tableName: string, params: SearchParams): Promise<T[]>
   delete(tableName: string, id: string): Promise<void>
   deleteByQuery(tableName: string, query: any): Promise<void>
}
