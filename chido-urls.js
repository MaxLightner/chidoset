export const CHIDO_URLS = Object.freeze({
  website: 'https://chidoset.ir/',
  application: 'https://app.chidoset.ir/',
  central: 'https://admin.chidoset.ir/',
});
export function deployedChidoHost(hostname = globalThis.location?.hostname || '') {
  return ['chidoset.ir', 'www.chidoset.ir', 'app.chidoset.ir', 'admin.chidoset.ir'].includes(hostname);
}
