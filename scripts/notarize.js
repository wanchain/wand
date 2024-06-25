require('dotenv').config();
const { notarize } = require('@electron/notarize')

exports.default = async function notarizing(context) {
    const { electronPlatformName, appOutDir } = context;
    const appName = context.packager.appInfo.productFilename;

    if (electronPlatformName !== 'darwin') {
        return
    }

    console.log('electronPlatformName: ', electronPlatformName)
    console.log('appOutDir: ', appOutDir)
    console.log('appName: ', appName)

    console.log('start notarizing...')
    try {
        return await notarize({
            teamId: 'org.wallet.wanchain',
            appPath: `${appOutDir}/${appName}.app`,
            appleId: process.env.APPLEID,
            appleIdPassword: process.env.APPLEIDPASS,
        })
    } catch (err) {
        console.error('notarizing error: ', err)
    }    
}
