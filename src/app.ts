import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: 'af-south-1' })
const docClient = DynamoDBDocumentClient.from(client)

// Table names
const PRODUCTS_TABLE = 'Products'
const STOCK_TABLE = 'Stock'

// Data types for demonstration
type Product = {
  productName: string
  description: string
  price: number
  category: string
  isActive: boolean
  tags: string[]
  metadata: {
    manufacturer: string
    weight: number
    dimensions: {
      length: number
      width: number
      height: number
    }
  }
  createdAt: string
  updatedAt: string
}

type Stock = {
  stockId: string
  productName: string
  quantity: number
  location: string
  isAvailable: boolean
  supplier: {
    name: string
    contact: string
    rating: number
  }
  lastRestocked: string
  minThreshold: number
  maxCapacity: number
}

// Generate sample product data
function generateProduct(productName: string): Product {
  const categories = ['Electronics', 'Computers', 'Mobile Devices', 'Audio', 'Gaming', 'Accessories', 'Smart Home', 'Office']
  const manufacturers = ['Apple', 'Samsung', 'Sony', 'Microsoft', 'Logitech', 'Razer', 'Bose', 'Dell', 'HP', 'Lenovo']
  const tags = ['premium', 'wireless', 'bluetooth', 'gaming', 'professional', 'portable', 'smart', 'high-end', 'budget-friendly', 'eco-friendly']
  
  return {
    productName,
    description: `High-quality ${productName} with advanced features and reliable performance`,
    price: Math.floor(Math.random() * 2000) + 50,
    category: categories[Math.floor(Math.random() * categories.length)],
    isActive: Math.random() > 0.1,
    tags: tags.slice(0, Math.floor(Math.random() * 4) + 2),
    metadata: {
      manufacturer: manufacturers[Math.floor(Math.random() * manufacturers.length)],
      weight: Math.floor(Math.random() * 5) + 0.5,
      dimensions: {
        length: Math.floor(Math.random() * 50) + 10,
        width: Math.floor(Math.random() * 30) + 5,
        height: Math.floor(Math.random() * 20) + 2
      }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

// Generate sample stock data
function generateStock(productName: string): Stock {
  const locations = ['Main Warehouse', 'Distribution Center', 'Store Location A', 'Store Location B', 'Online Fulfillment Center']
  const suppliers = [
    { name: 'TechSupply Co.', contact: 'orders@techsupply.com', rating: 4.5 },
    { name: 'Global Electronics', contact: 'sales@globalelectronics.com', rating: 4.2 },
    { name: 'Premium Parts Inc.', contact: 'info@premiumparts.com', rating: 4.8 },
    { name: 'Direct Import Ltd.', contact: 'contact@directimport.com', rating: 4.0 },
    { name: 'Quality Components', contact: 'support@qualitycomponents.com', rating: 4.6 }
  ]
  
  return {
    stockId: uuidv4(),
    productName,
    quantity: Math.floor(Math.random() * 500) + 10,
    location: locations[Math.floor(Math.random() * locations.length)],
    isAvailable: Math.random() > 0.05,
    supplier: suppliers[Math.floor(Math.random() * suppliers.length)],
    lastRestocked: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    minThreshold: Math.floor(Math.random() * 20) + 5,
    maxCapacity: Math.floor(Math.random() * 1000) + 200
  }
}

// Insert product into DynamoDB
async function insertProduct(product: Product, stockId: string): Promise<void> {
  const params = {
    TableName: PRODUCTS_TABLE,
    Item: {
      pk: `Product#${product.productName}`,
      sk: `Stock#${product.productName}#${stockId}`,
      ...product
    }
  }

  try {
    await docClient.send(new PutCommand(params))
    console.log(`✅ Product inserted: ${product.productName}`)
  } catch (error) {
    console.error(`❌ Error inserting product ${product.productName}:`, error)
    throw error
  }
}

// Insert stock into DynamoDB
async function insertStock(stock: Stock): Promise<void> {
  const params = {
    TableName: STOCK_TABLE,
    Item: {
      pk: `Stock#${stock.productName}#${stock.stockId}`,
      sk: 'Stock',
      ...stock
    }
  }

  try {
    await docClient.send(new PutCommand(params))
    console.log(`✅ Stock inserted: ${stock.stockId} for ${stock.productName}`)
  } catch (error) {
    console.error(`❌ Error inserting stock ${stock.stockId}:`, error)
    throw error
  }
}

// Update product in DynamoDB
async function updateProduct(productName: string, updates: Partial<Product>): Promise<void> {
  await delay(1000)

  const updateExpression: string[] = []
  const expressionAttributeNames: Record<string, string> = {}
  const expressionAttributeValues: Record<string, any> = {}

  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'productName') {
      const attrName = `#${key}`
      const attrValue = `:${key}`
      
      updateExpression.push(`${attrName} = ${attrValue}`)
      expressionAttributeNames[attrName] = key
      expressionAttributeValues[attrValue] = value
    }
  })

  updateExpression.push('#updatedAt = :updatedAt')
  expressionAttributeNames['#updatedAt'] = 'updatedAt'
  expressionAttributeValues[':updatedAt'] = new Date().toISOString()

  const params = {
    TableName: PRODUCTS_TABLE,
    Key: {
      pk: `Product#${productName}`,
      sk: `Stock#${productName}#`
    },
    UpdateExpression: `SET ${updateExpression.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues
  }

  try {
    await docClient.send(new UpdateCommand(params))
    console.log(`✅ Product updated: ${productName}`)
  } catch (error) {
    console.error(`❌ Error updating product ${productName}:`, error)
    throw error
  }
}

// Update stock in DynamoDB
async function updateStock(stockId: string, productName: string, updates: Partial<Stock>): Promise<void> {
  await delay(1000)

  const updateExpression: string[] = []
  const expressionAttributeNames: Record<string, string> = {}
  const expressionAttributeValues: Record<string, any> = {}

  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'stockId' && key !== 'productName') {
      const attrName = `#${key}`
      const attrValue = `:${key}`
      
      updateExpression.push(`${attrName} = ${attrValue}`)
      expressionAttributeNames[attrName] = key
      expressionAttributeValues[attrValue] = value
    }
  })

  const params = {
    TableName: STOCK_TABLE,
    Key: {
      pk: `Stock#${productName}#${stockId}`,
      sk: 'Stock'
    },
    UpdateExpression: `SET ${updateExpression.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues
  }

  try {
    await docClient.send(new UpdateCommand(params))
    console.log(`✅ Stock updated: ${stockId}`)
  } catch (error) {
    console.error(`❌ Error updating stock ${stockId}:`, error)
    throw error
  }
}

// Get product by name
async function getProduct(productName: string): Promise<Product | null> {
  const params = {
    TableName: PRODUCTS_TABLE,
    Key: {
      pk: `Product#${productName}`,
      sk: `Stock#${productName}#`
    }
  }

  try {
    const result = await docClient.send(new GetCommand(params))
    return result.Item as Product || null
  } catch (error) {
    console.error(`❌ Error getting product ${productName}:`, error)
    throw error
  }
}

// Get stock by ID
async function getStock(stockId: string, productName: string): Promise<Stock | null> {
  const params = {
    TableName: STOCK_TABLE,
    Key: {
      pk: `Stock#${productName}#${stockId}`,
      sk: 'Stock'
    }
  }

  try {
    const result = await docClient.send(new GetCommand(params))
    return result.Item as Stock || null
  } catch (error) {
    console.error(`❌ Error getting stock ${stockId}:`, error)
    throw error
  }
}

// Query all stock for a product
async function getStockForProduct(productName: string): Promise<Stock[]> {
  const params = {
    TableName: STOCK_TABLE,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
    ExpressionAttributeValues: {
      ':pk': `Stock#${productName}#`,
      ':sk': 'Stock'
    }
  }

  try {
    const result = await docClient.send(new QueryCommand(params))
    return (result.Items || []) as Stock[]
  } catch (error) {
    console.error(`❌ Error querying stock for product ${productName}:`, error)
    throw error
  }
}

// Main function to insert multiple records
async function insertMultipleRecords(numProducts: number, numStockPerProduct: number): Promise<void> {
  console.log(`🚀 Starting insertion of ${numProducts} products with ${numStockPerProduct} stock items each...`)

  const productNames = [
    'MacBook Pro 16-inch',
    'iPhone 15 Pro Max',
    'Samsung Galaxy S24 Ultra',
    'Sony WH-1000XM5 Headphones',
    'Logitech MX Master 3S Mouse',
    'Razer BlackWidow V3 Pro',
    'Dell XPS 15 Laptop',
    'Apple iPad Pro 12.9-inch',
    'Bose QuietComfort 45',
    'Microsoft Surface Pro 9',
    'Samsung 65-inch QLED TV',
    'Apple Watch Series 9',
    'Sony PlayStation 5',
    'Nintendo Switch OLED',
    'DJI Mini 3 Pro Drone',
    'GoPro Hero 11 Black',
    'Canon EOS R6 Mark II',
    'Nikon Z6 II Camera',
    'Samsung Galaxy Tab S9',
    'Apple AirPods Pro 2nd Gen',
    'Microsoft Xbox Series X',
    'Sony A7 IV Camera',
    'DJI RS 3 Pro Gimbal',
    'Rode NT1 Microphone',
    'Elgato Stream Deck MK.2'
  ]

  for (let i = 0; i < numProducts; i++) {
    const productName = productNames[i] || `Product-${i + 1}`
    const product = generateProduct(productName)
    
    try {
      for (let j = 0; j < numStockPerProduct; j++) {
        const stock = generateStock(productName)
        await insertStock(stock)
        await insertProduct(product, stock.stockId)
      }
    } catch (error) {
      console.error(`Failed to insert product ${productName}:`, error)
    }
  }

  console.log('✅ All records inserted successfully!')
}

// Example usage and demonstration
async function demonstrateOperations(): Promise<void> {
  console.log('🎯 Demonstrating DynamoDB operations...\n')

  await insertMultipleRecords(25, 2)

  console.log('\n📝 Demonstrating updates...')
  
  await updateProduct('MacBook Pro 16-inch', {
    price: 2499.99,
    isActive: true,
    tags: ['premium', 'professional', 'laptop', 'apple']
  })

  const product = await getProduct('MacBook Pro 16-inch')
  if (product) {
    console.log('\n📦 Retrieved product:', JSON.stringify(product, null, 2))
  }

  const stockItems = await getStockForProduct('MacBook Pro 16-inch')
  console.log(`\n📊 Found ${stockItems.length} stock items for MacBook Pro 16-inch`)

  if (stockItems.length > 0) {
    const firstStock = stockItems[0]
    await updateStock(firstStock.stockId, firstStock.productName, {
      quantity: 25,
      isAvailable: true,
      supplier: {
        ...firstStock.supplier,
        rating: 4.9
      }
    })
  }

  console.log('\n✅ Demonstration completed!')
}

// Run demonstration if this file is executed directly
if (require.main === module) {
  demonstrateOperations().catch(console.error)
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
