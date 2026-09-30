// Keep the local baseline separate from the Supabase-backed application graph.
if (import.meta.env.MODE === 'mock') {
  import('./mock/main.jsx')
} else {
  import('./main.jsx')
}
