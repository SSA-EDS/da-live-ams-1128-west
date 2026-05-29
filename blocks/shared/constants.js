export const CON_ORIGIN = 'https://content.ent-da.live';
export const AEM_ORIGIN = 'https://admin.ent-aem.page';

export const SUPPORTED_FILES = {
  html: 'text/html',
  jpeg: 'image/jpeg',
  json: 'application/json',
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  mp4: 'video/mp4',
  pdf: 'application/pdf',
  svg: 'image/svg+xml',
};

const DA_ADMIN_ENVS = {
  local: 'http://localhost:8787',
  // stage: 'https://stage-admin.da.live',
  // prod: 'https://admin.da.live',
  stage: 'https://stg-admin.ssa-da.live',
  prod: 'https://admin.ent-da.live',
};

const DA_COLLAB_ENVS = {
  local: 'ws://localhost:4711',
  stage: 'wss://stg-collab.ssa-da.live',
  prod: 'wss://collab.ent-da.live',
};

function getDaEnv(location, key, envs) {
  const { href } = location;
  const query = new URL(href).searchParams.get(key);
  if (query && query === 'reset') {
    localStorage.removeItem(key);
  } else if (query) {
    localStorage.setItem(key, query);
  }
  const isStage = location.origin.includes('stg.ssa-da');
  const defaultEnv = isStage ? 'stage' : 'prod';
  const env = envs[localStorage.getItem(key) || defaultEnv];
  return location.origin === 'https://stg.ssa-da.page' ? env.replace('.live', '.page') : env;
}

export const getDaAdmin = (() => {
  let daAdmin;
  return (location) => {
    if (!location && daAdmin) return daAdmin;
    daAdmin = getDaEnv(location || window.location, 'da-admin', DA_ADMIN_ENVS);
    return daAdmin;
  };
})();

export const DA_ORIGIN = (() => getDaEnv(window.location, 'da-admin', DA_ADMIN_ENVS))();
export const COLLAB_ORIGIN = (() => getDaEnv(window.location, 'da-collab', DA_COLLAB_ENVS))();
