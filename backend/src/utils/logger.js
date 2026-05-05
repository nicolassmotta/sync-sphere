import winston from 'winston';
import 'winston-daily-rotate-file';

// O Arquivo salva os logs rotatórios dentro da pasta /logs na raiz do projeto do Node.
const transportRotate = new winston.transports.DailyRotateFile({
  dirname: 'logs',
  filename: 'syncsphere-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,      // Salva espaço transformando em Zip se passar de 1 dia
  maxSize: '20m',           // O log file pode ter no máximo 20 megabytes 
  maxFiles: '14d',          // Mantem evidências salvas por duas semanas e exclui automaticamente as mais velhas
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(
      (info) => `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`
    )
  ),
  transports: [
    transportRotate, // Envia para os arquivos de Históricos
  ],
});

// Se NODE_ENV não for production, também envia os logs para o console local.
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

export default logger;
