/**
 * pg-boss consumers land in M5+. M1 stub keeps the process bootable.
 */
console.info("[worker] stub started — job handlers land in M5+");

// Keep process alive in dev so turbo doesn't treat exit as failure.
if (process.env.WORKER_STUB_EXIT !== "1") {
  setInterval(() => {}, 60_000);
}
