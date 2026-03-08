module.exports = {
    apps: [
        {
            name: 'learnverse-backend',
            script: 'server1.js',
            cwd: './AWS',
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            }
        },
        {
            name: 'learnverse-frontend-api',
            script: 'node_modules/.bin/tsx',
            args: 'server.ts --port 3001 --host',
            cwd: './learnverse_7',
            env: {
                NODE_ENV: 'production',
                PORT: 3001
            }
        }
    ]
};
