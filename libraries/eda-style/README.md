# eda-style

[`eda-style.rnl`](eda-style.rnl) is the public extension package `eda-style` 0.1 for RNL 0.3: 137 schematic symbols with green hairline strokes, red terminal markers and monospaced labels. It is loaded from a package file and is not bundled into the core.

## Use

Add this header to a Spectre netlist (use `*` instead of `//` in SPICE):

```spectre
// @RNL(type="header") {
//   @VERSION("0.3");
//   @USE-PACKAGE(name="eda-style", version="0.1")
// }
```

Make the package available to the viewer or command:

- **Web viewer:** open **Library → Include Public Package…**, search for `eda-style` and include version `0.1`, then open your netlist or the gallery below.
- **Desktop viewer:** add `eda-style.rnl` with **Library → Include File…**, or add its directory with **Library → Add PATH Directory…**.
- **Command line:** pass the package directory with `--path`:

```sh
rnl check libraries/eda-style/eda-style.rnl
rnl check libraries/eda-style/eda-style-gallery.scs --path libraries/eda-style
rnl render libraries/eda-style/eda-style-gallery.scs --path libraries/eda-style -o out/eda-style
```

The package **replaces standard symbol names**, including `$RESISTOR`, `$CAPACITOR`, `$NMOS_4TERM`, `$OPAMP`, `$AND_2INPUT` and `$GROUND_SYMBOL`, as well as the base styles, at the level that uses it and below. The corresponding hints about hiding standard definitions are expected. Use it after other packages whose appearance it should replace.

## Appearance and contents

Symbol lines are green (`#00cc66`) hairlines (`linewidth=0`); terminals are solid red (`#ff0000`) squares, 0.8 × 0.8 grid units, or red port polygons. Wires use hairlines. Green lines and red terminals stand out on a dark background; the viewer also supports a light background. Labels hint `Lucida Console, Monaco, DejaVu Sans Mono, Consolas, monospace`, with the available font chosen by the viewer.

| Category | Symbols |
| --- | ---: |
| Standard RNL 0.3 symbol names | 93 |
| Additional sources, switches, amplifiers, RF parts and filters | 44 |
| Total | 137 |

[`eda-style-gallery.scs`](eda-style-gallery.scs) places 130 visually distinct symbols in a 12-column top-level gallery, with six thematic subcircuits for closer inspection. It is an example netlist; the public package index and website package gallery read only `.rnl` files.
