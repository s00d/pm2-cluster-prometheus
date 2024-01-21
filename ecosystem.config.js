module.exports = {
  apps: [
    {
      name: 'charge',
      script: './test.js',
      args: 'start',
      max_memory_restart: '1G',
      instances: '1', // 'max', Or a number of instances
      exec_mode: 'cluster',
      watch: false,
      merge_logs: true,
      out_file: './pm2.log',
      error_file: './pm2_err.log',
      log_date_format: 'YYY-MM-DD HH:mm:ss.SSS',
      env: {
        NODE_ENV: 'production',
        HOST: 0,
        PORT: 3001,
      },
    },
  ],
};
// pm2 restart ecosystem.config.js --only onlinesim-ssr-landing
