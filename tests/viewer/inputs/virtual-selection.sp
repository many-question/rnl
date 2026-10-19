* Independent virtual symbols sharing a net
* @RNL(type="header") { @VERSION("0.3") }
.subckt cell a b
Rinside a b 1k
.ends
R1 rail out 1k
R2 inp out 2k
X1 out rail cell
* @RNL {
*   #R1 @PLACE(0, 0); #R2 @PLACE(14, 0); #X1 @PLACE(22, 0);
*   %ground = $GROUND @ATTACH &rail; %ground @PLACE(-8, -4);
*   %ground2 = $GROUND @ATTACH &rail; %ground2 @PLACE(-2, -4);
*   %supply = $SUPPLY @ATTACH &rail; %supply @PLACE(8, 6);
*   %port = $IO_PORT @ATTACH &inp; %port @PLACE(10, 6);
*   %junction = $JUNCTION @ATTACH (4, -5);
*   &rail @WIRE {%ground:1 (-8, 3) #R1:1 (8, 3) %supply:1};
*   &rail @WIRE {%ground2:1 (-2, 3)};
*   &inp @WIRE {%port:1 #R2:1}
* }
.end
