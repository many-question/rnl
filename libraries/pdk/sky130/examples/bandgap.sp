* CMOS bandgap reference core in SkyWater SKY130 (sky130_fd_pr), placed with RNL 0.3
* .include "sky130_fd_pr_stub.spice"
XM1 n1 n1 vdd vdd sky130_fd_pr__pfet_01v8_lvt w=4 l=0.5
XM2 vbg n1 vdd vdd sky130_fd_pr__pfet_01v8_lvt w=4 l=0.5
XR1 n1 ve1 0 sky130_fd_pr__res_high_po_0p35 l=10
XR2 vbg vx 0 sky130_fd_pr__res_high_po_0p35 l=10
XR3 vx ve2 0 sky130_fd_pr__res_high_po_0p35 l=2
XQ1 0 0 ve1 0 sky130_fd_pr__pnp_05v5_W3p40L3p40 mult=1
XQ2 0 0 ve2 0 sky130_fd_pr__pnp_05v5_W3p40L3p40 mult=8
Vdd vdd 0 1.8
* @RNL(type="header") {
*   @VERSION("0.3");
*   @USE-PACKAGE(name="rnl-pdk-sky130", version="0.1")
* }
* @RNL {
*   &vdd @ADD-TO $SUPPLY_NET_SET;
*   # @SELECT-INSTANCE(model="sky130_fd_pr__pfet_*") => @TEXT("W/L=${w}/${l}", key="model");
*   # @SELECT-INSTANCE(model="sky130_fd_pr__res_*") => @TEXT("W/L=0.35/${l}", key="value");
*   # @SELECT-INSTANCE(model="sky130_fd_pr__pnp_*") => @TEXT("m=${mult}", key="model");
*
*   %cm = {#XM1}(ref) {#XM2}(out) @AS $CURRENT_MIRROR;
*   %b1 = {#XM1 #XR1 #XQ1} @AS $BRANCH;
*   %b2 = {#XM2 #XR2 #XR3 #XQ2} @AS $BRANCH;
*
*   %jn1 = (-8, 8); %jg = (0, 12); %jvbg = (8, 8);
*   &n1 @WIRE {#XM1:d %jn1 #XR1:r0};
*   &n1 @WIRE {#XM1:g %jg #XM2:g};
*   &n1 @WIRE(mode="horizontal-vertical") {%jn1 %jg};
*   &vbg @WIRE {#XM2:d %jvbg #XR2:r0};
*   &ve1 @WIRE {#XR1:r1 #XQ1:e};
*   &vx @WIRE {#XR2:r1 #XR3:r0};
*   &ve2 @WIRE {#XR3:r1 #XQ2:e};
*   $JUNCTION @ATTACH {%jn1 %jg %jvbg};
*
*   $IO_PORT @ATTACH &vbg => @ORIENT("MY") => %p_vbg;
*   &vbg @WIRE {%jvbg %p_vbg:p}
* }
* @RNL(type="generated", priority="high") {
*   #XM1 @PLACE(-8, 12) => @ORIENT("MY"); #XM2 @PLACE(8, 12);
*   #XR1 @PLACE(-8, 4); #XR2 @PLACE(8, 4); #XR3 @PLACE(8, -2);
*   #XQ1 @PLACE(-8, -8); #XQ2 @PLACE(8, -8);
*   #Vdd @PLACE(22, 6);
*   %p_vbg @PLACE(14, 8);
*   %gs_XR1_b = $GROUND_STUB @ATTACH #XR1:b; %gs_XR1_b::g @PLACE(-10, 1);
*   %gs_XR2_b = $GROUND_STUB @ATTACH #XR2:b; %gs_XR2_b::g @PLACE(6, 1);
*   %gs_XR3_b = $GROUND_STUB @ATTACH #XR3:b; %gs_XR3_b::g @PLACE(6, -5);
*   %gs_XQ1_c = $GROUND_STUB @ATTACH #XQ1:c; %gs_XQ1_c::g @PLACE(-8, -12);
*   %gs_XQ1_b = $GROUND_STUB @ATTACH #XQ1:b; %gs_XQ1_b::g @PLACE(-11, -11);
*   %gs_XQ1_s = $GROUND_STUB @ATTACH #XQ1:s; %gs_XQ1_s::g @PLACE(-7, -11);
*   %gs_XQ2_c = $GROUND_STUB @ATTACH #XQ2:c; %gs_XQ2_c::g @PLACE(8, -12);
*   %gs_XQ2_b = $GROUND_STUB @ATTACH #XQ2:b; %gs_XQ2_b::g @PLACE(5, -11);
*   %gs_XQ2_s = $GROUND_STUB @ATTACH #XQ2:s; %gs_XQ2_s::g @PLACE(9, -11);
*   %gs_Vdd_n = $GROUND_STUB @ATTACH #Vdd:n; %gs_Vdd_n::g @PLACE(22, 1);
*   %ss_XM1_s = $SUPPLY_STUB @ATTACH #XM1:s; %ss_XM1_s::s @PLACE(-8, 16);
*   %ss_XM1_b = $SUPPLY_STUB @ATTACH #XM1:b; %ss_XM1_b::s @PLACE(-9, 15);
*   %ss_XM2_s = $SUPPLY_STUB @ATTACH #XM2:s; %ss_XM2_s::s @PLACE(8, 16);
*   %ss_XM2_b = $SUPPLY_STUB @ATTACH #XM2:b; %ss_XM2_b::s @PLACE(9, 15);
*   %ss_Vdd_p = $SUPPLY_STUB @ATTACH #Vdd:p; %ss_Vdd_p::s @PLACE(22, 11)
* }
.end
