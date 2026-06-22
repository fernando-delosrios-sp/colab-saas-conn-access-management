import { stringToMembership } from './src/utils/membership-parser'

async function test() {
    try {
        const result = await stringToMembership('identity.foo eq "bar"', [])
        console.log(JSON.stringify(result, null, 2))
    } catch (e) {
        console.error(e)
    }
}

test()
