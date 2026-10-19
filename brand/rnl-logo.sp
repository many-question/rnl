* RNL Official Logo (RNL 0.3 — Final Compact Triangle Ground Version)
* @RNL(type="header") { @VERSION("0.3") }
.model nch nmos level=1
M1 0 0 0 0 nch W=4u L=0.5u

* @RNL {
*   /* 1. Generic drawable circuit & layout using standard library names */
*   # @SELECT-INSTANCE(type="nmos") => @SET-SYMBOL $NMOS;
*   #M1:b @REMOVE-FROM $GROUND_FILL_SET;
*   #M1 @PLACE(-1, 1) => @ORIENT("MY");
*   %g0 = $GROUND @ATTACH &0 => @PLACE(0.9, -4.2) => @ORIENT("R90");
*   %jg = (3, 1);
*   &0 @WIRE(mode="straight") {
*     #M1:d #M1:s (-1, -2.2) (3, -2.2) %jg
*     (3, 4.2) (-3, 4.2) (-3, -4.2) %g0:p
*   };
*   &0 @WIRE(mode="straight") {#M1:g %jg};
*   $JUNCTION @ATTACH {#M1:d #M1:s %jg}
* }

* @RNL {
*   /* 2. Logo theme override layer (can be removed to render with pure rnl-std 0.3) */
*   $base = @DEFINE-STYLE(linecolor="#1d1d1f", textcolor="#1d1d1f", fillcolor="#1d1d1f", linewidth=0.36, cap="round", join="round") {};
*   $signal = @DEFINE-STYLE(linecolor="#e8590c", fillcolor="#e8590c") {$base};
*
*   $NMOS = @DEFINE-SYMBOL(box=[-3.4, -1.75, 0.4, 1.75]) {
*     (0, 1) @PIN(terminal=1, direction="up");
*     (-3, 0) @PIN(terminal=2, direction="left");
*     (0, -1) @PIN(terminal=3, direction="down");
*     @LINE {(0, 1) (-1.85, 1)};
*     @LINE {(0, -1) (-1.85, -1)};
*     @LINE(fill="linecolor", linestyle="none") {(-0.60, -1) (-1.43, -0.44) (-1.43, -1.56) (-0.60, -1)};
*     @LINE {(-1.85, -1.68) (-1.85, 1.68)};
*     @LINE {(-2.65, -0.88) (-2.65, 0.88)};
*     @LINE {(-2.65, 0) (-3, 0)}
*   };
*
*   $GROUND_SYMBOL = @DEFINE-SYMBOL(box=[-0.9, -2.15, 0.9, 0]) {
*     (0, 0) @PIN(terminal=1, direction="up");
*     @LINE {(0, 0) (0, -0.90)};
*     @LINE {(-0.85, -0.90) (0.85, -0.90) (0, -2.10) (-0.85, -0.90)}
*   };
*
*   $JUNCTION_SYMBOL = @DEFINE-SYMBOL(box=[-0.5, -0.5, 0.5, 0.5]) {
*     (0, 0) @CIRCLE(radius=0.50, fill="linecolor", linestyle="none")
*   };
*
*   # @SELECT-INSTANCE => @SET-STYLE $base;
*   # @SELECT-USAGE => @SET-STYLE $base;
*   # @SELECT-WIRE => @SET-STYLE $base;
*   # @SELECT-INSTANCE(type="nmos") => @SET-SYMBOL $NMOS;
*   # @SELECT-USAGE $GROUND => @SET-SYMBOL $GROUND_SYMBOL;
*   # @SELECT-USAGE $JUNCTION => @SET-SYMBOL $JUNCTION_SYMBOL => @SET-STYLE $signal => @LAYER("top")
* }
.end
