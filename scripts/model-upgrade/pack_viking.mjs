// Compatibility entry point: one compression policy for fleet and Viking-only rebuilds.
process.argv.splice(2,process.argv.length-2,'viking-lander');
await import('./pack_global.mjs');
