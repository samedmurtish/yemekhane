module.exports = {
  port: Number(process.env.PORT || 8000),
  primary: {
    host: process.env.DB_YAZMA_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_ADI,
    user: process.env.DB_KULLANICI,
    password: process.env.DB_SIFRE,
    charset: 'utf8mb4'
  },
  replica: {
    host: process.env.DB_OKUMA_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_ADI,
    user: process.env.DB_KULLANICI,
    password: process.env.DB_SIFRE,
    charset: 'utf8mb4'
  }
};
