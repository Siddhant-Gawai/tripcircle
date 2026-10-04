import type { SupabaseClient } from "@supabase/supabase-js";
/** Empty invalidation signals; actual data always comes from checked RPCs. */
export function subscribeUpdates(
  db: SupabaseClient,
  topic: string,
  privateChannel: boolean,
  refresh: () => void,
  onError: () => void,
) {
  if (import.meta.env.VITE_TRIPCIRCLE_REALTIME_ENABLED === "false")
    return () => {};
  let stopped = false;
  let fallback: ReturnType<typeof setInterval> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const update = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!stopped) refresh();
    }, 100);
  };
  const channel = db
    .channel(topic, { config: { private: privateChannel } })
    .on("broadcast", { event: "changed" }, update)
    .subscribe((status) => {
      if (stopped) return;
      if (status === "SUBSCRIBED") {
        clearInterval(fallback);
        fallback = undefined;
        update();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onError();
        if (!fallback) fallback = setInterval(update, 60000);
      }
    });
  return () => {
    stopped = true;
    clearTimeout(timer);
    clearInterval(fallback);
    void db.removeChannel(channel);
  };
}
