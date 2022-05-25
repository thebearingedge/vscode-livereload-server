import esbuild from 'esbuild'
import yargs from 'yargs-parser'

const { _, ...argv } = yargs(process.argv.slice(2)) ?? {}

void esbuild.build({
  bundle: true,
  logLevel: 'info',
  platform: 'node',
  format: 'cjs',
  entryPoints: [
    './src/index.ts'
  ],
  outfile: './dist/index.js',
  external: [
    'batch',
    'vscode',
    'fsevents',
    'livereload-js'
  ],
  ...argv
}).catch(err => {
  console.error(err)
  process.exit(1)
})
