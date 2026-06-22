import { logger } from '@sailpoint/connector-sdk'
import axios from 'axios'

async function test() {
    try {
        await axios.get('https://httpstat.us/404', { headers: { Authorization: 'Bearer SUPER_SECRET_TOKEN' } })
    } catch (error) {
        console.log("Direct console.log:")
        console.log(error)
        console.log("logger.error:")
        logger.error(error)
    }
}
test()
