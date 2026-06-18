/** Carrier capacity listing lifecycle — use POST routes (PATCH must not set status). */

export async function closeCarrierSpace(request, id) {
  return request({ method: 'POST', url: `/carrier-space/${id}/close` });
}

export async function reopenCarrierSpace(request, id) {
  return request({ method: 'POST', url: `/carrier-space/${id}/reopen` });
}
