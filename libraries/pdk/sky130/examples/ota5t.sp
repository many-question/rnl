* Five-transistor OTA in SkyWater SKY130 (sky130_fd_pr), placed with RNL 0.3
* .include "sky130_fd_pr_stub.spice"
XM1 x inp tail 0 sky130_fd_pr__nfet_01v8 w=4 l=0.15
XM2 out inn tail 0 sky130_fd_pr__nfet_01v8 w=4 l=0.15
XM3 x x vdd vdd sky130_fd_pr__pfet_01v8 w=8 l=0.15
XM4 out x vdd vdd sky130_fd_pr__pfet_01v8 w=8 l=0.15
XM5 tail bias 0 0 sky130_fd_pr__nfet_01v8 w=8 l=0.5
XM6 bias bias 0 0 sky130_fd_pr__nfet_01v8 w=8 l=0.5
Ib vdd bias 20u
XCL out 0 sky130_fd_pr__cap_mim_m3_1 w=10 l=10
Vdd vdd 0 1.8
* @RNL(type="header") {
*   @VERSION("0.3");
*   @USE-PACKAGE(name="rnl-pdk-sky130", version="0.1")
* }
* @RNL {
*   &vdd @ADD-TO $SUPPLY_NET_SET;
*   # @SELECT-INSTANCE(model="sky130_fd_pr__*fet*") => @TEXT("W/L=${w}/${l}", key="model");
*   #XCL @TEXT("${w}\times{}${l} \mu{}m^{2}", key="value");
*
*   %dp = #XM1(in_p) #XM2(in_n) #XM5(tail) @AS $DIFFERENTIAL_PAIR;
*   %cm = {#XM3}(ref) {#XM4}(out) @AS $CURRENT_MIRROR;
*
*   %jd = (-6, 4); %jg = (-2, 8); %jo = (6, 4); %jc = (16, 4); %jt = (0, -3);
*   %jb = (-22, -3.5); %j6 = (-14, -6);
*   &x @WIRE {#XM3:d %jd #XM1:d};
*   &x @WIRE {#XM3:g %jg #XM4:g};
*   &x @WIRE(mode="horizontal-vertical") {%jd %jg};
*   &out @WIRE {#XM4:d %jo #XM2:d};
*   &tail @WIRE(mode="vertical-horizontal") {#XM1:s %jt};
*   &tail @WIRE(mode="vertical-horizontal") {#XM2:s %jt};
*   &tail @WIRE {%jt #XM5:d};
*   &bias @WIRE {#Ib:n %jb #XM6:d};
*   &bias @WIRE {#XM6:g %j6 #XM5:g};
*   &bias @WIRE(mode="vertical-horizontal") {%j6 %jb};
*   $JUNCTION @ATTACH {%jd %jg %jo %jc %jt %jb %j6};
*
*   %pi = $IO_PORT @ATTACH &inp;
*   $IO_PORT @ATTACH &inn => @ORIENT("MY") => %pn;
*   $IO_PORT @ATTACH &out => @ORIENT("MY") => %po;
*   &inp @WIRE {%pi:p #XM1:g};
*   &inn @WIRE {%pn:p #XM2:g};
*   &out @WIRE {%jo %jc %po:p};
*   &out @WIRE {%jc #XCL:c0}
* }
* @RNL(type="generated", priority="high") {
*   #XM1 @PLACE(-6, 0); #XM2 @PLACE(6, 0) => @ORIENT("MY");
*   #XM3 @PLACE(-6, 8) => @ORIENT("MY"); #XM4 @PLACE(6, 8);
*   #XM5 @PLACE(0, -6); #XM6 @PLACE(-22, -6) => @ORIENT("MY"); #Ib @PLACE(-22, 0);
*   #XCL @PLACE(16, 1); #Vdd @PLACE(28, 4);
*   %pi @PLACE(-11, 0); %pn @PLACE(11, 0); %po @PLACE(21, 4);
*   %gs_XM1_b = $GROUND_STUB @ATTACH #XM1:b; %gs_XM1_b::g @PLACE(-5, -3);
*   %gs_XM2_b = $GROUND_STUB @ATTACH #XM2:b; %gs_XM2_b::g @PLACE(5, -3);
*   %gs_XM5_s = $GROUND_STUB @ATTACH #XM5:s; %gs_XM5_s::g @PLACE(0, -10);
*   %gs_XM5_b = $GROUND_STUB @ATTACH #XM5:b; %gs_XM5_b::g @PLACE(1, -9);
*   %gs_XM6_s = $GROUND_STUB @ATTACH #XM6:s; %gs_XM6_s::g @PLACE(-22, -10);
*   %gs_XM6_b = $GROUND_STUB @ATTACH #XM6:b; %gs_XM6_b::g @PLACE(-23, -9);
*   %gs_XCL_c1 = $GROUND_STUB @ATTACH #XCL:c1; %gs_XCL_c1::g @PLACE(16, -3);
*   %gs_Vdd_n = $GROUND_STUB @ATTACH #Vdd:n; %gs_Vdd_n::g @PLACE(28, -1);
*   %ss_XM3_s = $SUPPLY_STUB @ATTACH #XM3:s; %ss_XM3_s::s @PLACE(-6, 12);
*   %ss_XM3_b = $SUPPLY_STUB @ATTACH #XM3:b; %ss_XM3_b::s @PLACE(-7, 11);
*   %ss_XM4_s = $SUPPLY_STUB @ATTACH #XM4:s; %ss_XM4_s::s @PLACE(6, 12);
*   %ss_XM4_b = $SUPPLY_STUB @ATTACH #XM4:b; %ss_XM4_b::s @PLACE(7, 11);
*   %ss_Ib_p = $SUPPLY_STUB @ATTACH #Ib:p; %ss_Ib_p::s @PLACE(-22, 5);
*   %ss_Vdd_p = $SUPPLY_STUB @ATTACH #Vdd:p; %ss_Vdd_p::s @PLACE(28, 9)
* }
.end
