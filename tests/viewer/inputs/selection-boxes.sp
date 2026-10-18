* Explicit and inferred symbol boxes
* @RNL(type="header") { @VERSION("0.3") }
.subckt cell a b
R1 a b 1k
.ends
Xexplicit a b cell
Xinferred b 0 cell
* @RNL {
*   $explicit = @DEFINE-SYMBOL(box=[-3, -2, 3, 2]) {
*     (-3, 0) @PIN(terminal="a", direction="left"); (3, 0) @PIN(terminal="b", direction="right");
*     @RECTANGLE {(-3, -2) (3, 2)};
*     (0, -1.5) @CIRCLE(radius=0.2, fill="fillcolor", fillcolor="#000000", linestyle="none");
*     (0, 0) @TEXT("Explicit box", halign="middle", valign="middle")
*   };
*   $inferred = @DEFINE-SYMBOL {
*     (-3, 0) @PIN(terminal="a", direction="left"); (3, 0) @PIN(terminal="b", direction="right");
*     @LINE {(-3, 0) (-2, 0) (-2, 1) (2, 1) (2, 0) (3, 0)};
*     @LINE {(-2, 0) (-2, -1) (2, -1) (2, 0)};
*     (0, 0) @TEXT("Inferred box", halign="middle", valign="middle")
*   };
*   #Xexplicit @SET-SYMBOL $explicit; #Xexplicit @PLACE(0, 0); #Xexplicit @ORIENT("R90");
*   #Xinferred @SET-SYMBOL $inferred; #Xinferred @PLACE(12, 0)
* }
.end
