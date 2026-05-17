const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * After POST truck, refetch list and retry once if new row missing.
 * @param {{ saved: object, fetchList: () => Promise<object[]>, setTrucks: Function }} opts
 */
export async function syncTrucksAfterCreate({ saved, fetchList, setTrucks }) {
  let list = await fetchList();
  if (saved?.id && list.some((t) => String(t.id) === String(saved.id))) return;

  await sleep(800);
  list = await fetchList();
  if (saved?.id && list.some((t) => String(t.id) === String(saved.id))) return;

  setTrucks((prev) => {
    if (!saved?.id || prev.some((t) => String(t.id) === String(saved.id))) return prev;
    return [saved, ...prev];
  });
}
