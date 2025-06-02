import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

export default {
  input: 'src/cli.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: '[name].js',
  },
  plugins: [
    typescript(),
    terser({
      format: {
        comments: 'some',
        beautify: true,
        ecma: '2022'
      },
      compress: false,
      mangle: false,
      module: true,
    })
  ]
}