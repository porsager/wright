const test = require('tape')
const { wrightDataDirectory, getAppDataDirectory } = require('../lib/utils')

const fakeProcess = {
    linux(){
        return {
            platform: 'linux',
            env: {
                HOME: '/home/porsager',
                PATH: [
                    '/home/porsager/something/something',
                    '/usr/bin/something'
                ]
                .join(':')
            }
        }
    },
    windows(){
        return {
            platform: 'win32',
            env: {
                HOMEPATH: 'C:\\Users\\porsager',
                PATH: [
                    'C:\\Users\\porsager\\something\\something',
                    'C:\\Program Files (x86)\\something',
                    'C:\\Program Files\\something',
                ]
                .join(';')
            }
        }
    },
    wsl(){
        return {
            platform: 'linux',
            env: {
                HOME: '/home/porsager',
                WSL_DISTRO_NAME: 'Ubuntu-18.04',
                PATH: [
                    '/home/porsager/something/something',
                    '/usr/bin/something',
                    '/mnt/c/Users/porsager/example'
                ]
                .join(':')
            }
        }
    },
}

// So the test's pass on all platforms (path.join, path.resolve etc)
const normalize = s => s.replace(/\\/g, '/')

test('linux', (t) => {
    const process = fakeProcess.linux()
    const wrightData = wrightDataDirectory(process)
    const appData = normalize(getAppDataDirectory(process, 'example'))
    
    t.equals(normalize(wrightData.chrome), '/home/porsager/.wright', 'Chrome')
    t.equals(appData, '/home/porsager/.wright/example', 'AppData')
    t.equals(normalize(wrightData.node), '/home/porsager/.wright', 'Node')
    t.end()
})

test('windows', (t) => {
    const process = fakeProcess.windows()
    const wrightData = wrightDataDirectory(process)
    const appData = normalize(getAppDataDirectory(process, 'example'))
    
    t.equals(normalize(wrightData.chrome), 'C:/Users/porsager/.wright', 'Chrome')
    t.equals(appData, 'C:/Users/porsager/.wright/example', 'AppData')
    t.equals(normalize(wrightData.node), 'C:/Users/porsager/.wright', 'Node')
    t.end()
})

test('wsl', (t) => {
    const process = fakeProcess.wsl()
    const wrightData = wrightDataDirectory(process)
    const appData = normalize(getAppDataDirectory(process, 'example'))
    
    t.equals(normalize(wrightData.chrome), 'C:/Users/porsager/.wright', 'Chrome')
    t.equals(appData, 'C:/Users/porsager/.wright/example', 'AppData')
    t.equals(normalize(wrightData.node), '/mnt/c/Users/porsager/.wright', 'Node')
    t.end()
})
