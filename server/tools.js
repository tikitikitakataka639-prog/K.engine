"use strict";
// Punto de extensión para herramientas/búsqueda (p. ej. n8n). Deliberadamente vacío:
// /chat NO ejecuta herramientas a partir de texto del usuario.
const tools = { enabled: false, registry: {} };
export default tools;
export const enabled = false;
export const registry = {};
