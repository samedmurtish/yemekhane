const express = require('express');
const routes = require('./routes');
const config = require('./config');
const { sessionMiddleware, errorHandler } = require('./middleware');
const redisService = require('./services/redisService');

const app = express();
app.use(express.json());
app.use(sessionMiddleware);
app.use(routes);
app.use(errorHandler);

redisService.clearMenuCaches()
  .catch((error) => console.error(`[CACHE CLEANUP ERROR] ${error.message}`))
  .finally(() => {
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`Application listening on port ${config.port}`);
    });
  });
