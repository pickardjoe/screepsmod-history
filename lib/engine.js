const childProcess = require("child_process");

const KEEP_TICKS = process.env.HISTORY_KEEP_TICKS;

module.exports = function engine(config) {
  const { env } = config.common.storage;
  config.engine.historyChunkSize = config.history.opts.historyChunkSize;
  config.engine.on("init", function(processType) {
    if (processType === "processor") {
      startWorker(config);
      config.engine.driver.history.upload = async (roomId, baseTime) => {
        const data = await env.get(env.keys.ROOM_HISTORY + roomId);
        await env.del(env.keys.ROOM_HISTORY + roomId);
        config.history.worker.send({
          method: "upload",
          roomId,
          baseTime,
          data
        });
          if (parseInt(KEEP_TICKS)) {
          if (baseTime % 1000 === 0) {
            config.history.worker.send({
              method: "cleanup",
              roomId,
              beforeTick: baseTime - KEEP_TICKS
            });
          }
        }
      };
    }
  });
};

function startWorker(config) {
  const child = childProcess.fork(`${__dirname}/worker.js`, [], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", process.stdout, process.stderr, "ipc"]
  });
  child.on("exit", () => startWorker(config));
  child.on("message", message => {
    config.history.emit("message", message);
  });
  config.history.worker = child;
}
