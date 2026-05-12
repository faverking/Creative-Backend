module.exports = {
  apps: [
    {
      name: 'mononest-api',
      cwd: __dirname,
      script: 'dist/src/main.js',
      exec_mode: 'fork',
      instances: 1,
      node_args: '--enable-source-maps',
      watch: false,
      max_memory_restart: '512M',
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
