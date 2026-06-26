import { createApp } from './app';
import { startCrons } from './modules/crons';

const PORT = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(PORT, () => {
  console.log(`STAY backend listening on :${PORT}`);
  startCrons();
});
