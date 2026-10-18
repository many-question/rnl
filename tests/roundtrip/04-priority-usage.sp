* A generated usage becomes explicit; its wire suppresses the next generation.
* @RNL(type="header") { @VERSION("0.3") }
R1 a b 1k
* @RNL {
*   $PART = @DEFINE-SYMBOL { (0, 2) @PIN(terminal=1); (0, -2) @PIN(terminal=2) };
*   #R1 @SET-SYMBOL $PART;
*   $MARK = @DEFINE(roles=[["t", "terminal"]]) {
*     %p = (_, _); ?t::net @WIRE {?t %p};
*     %low = {?t %p} @ALIGN("x", priority="low");
*     %high = %p ?t @DISTANCE("bottom-to-top", min=2, priority="high");
*     %plain = %p ?t @DISTANCE("bottom-to-top", max=6)
*   };
*   $OPEN = # @SELECT-TERMINAL(net="b", wired=false)
* }
* @RNL { $MARK @ATTACH(priority="high") $OPEN }
.end
