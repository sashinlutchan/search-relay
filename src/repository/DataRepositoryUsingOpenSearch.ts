import { Client } from '@opensearch-project/opensearch'
import { SearchParams } from '../types'
import { DataService } from './DataService'

export class DataRepository implements DataService {
   private client: Client

   constructor(opensearchClient: Client) {
      this.client = opensearchClient
   }

   async create(tableName: string, id: string, data: object): Promise<boolean> {
      await this.client.index({
         index: tableName,
         id: id,
         body: data,
         refresh: 'wait_for',
      })
      return true
   }

   async get<T>(tableName: string, id: string): Promise<T> {
      const getRes = await this.client.get({ index: tableName, id: id })
      return getRes.body._source as T
   }

   async search<T>(tableName: string, params: SearchParams = {}): Promise<T[]> {
      const searchRes = await this.client.search({
         index: tableName,
         body: {
            query: params.query || { match_all: {} },
            sort: params.sort,
            from: params.from,
            size: params.size,
         },
      })
      return searchRes.body.hits.hits.map((hit) => hit._source as T)
   }

   async delete(tableName: string, id: string): Promise<void> {
      await this.client.delete({
         index: tableName,
         id: id,
         refresh: 'wait_for',
      })
   }

   async deleteByQuery(tableName: string, query: any): Promise<void> {
      await this.client.deleteByQuery({ index: tableName, body: { query } })
   }
}
