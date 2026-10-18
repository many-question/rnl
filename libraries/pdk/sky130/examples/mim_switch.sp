* Switched-capacitor sampling network with MIM capacitors, CMOS switches, and ESD diode in SkyWater SKY130
* .include "sky130_fd_pr_stub.spice"
XD1 0 vin sky130_fd_pr__diode_pw2nd_05v5 area=1e12
XMN1 vin clk vsamp 0 sky130_fd_pr__nfet_01v8_lvt w=2 l=0.15
XMP1 vsamp clkb vin vdd sky130_fd_pr__pfet_01v8_lvt w=4 l=0.15
XC1 vsamp vbot sky130_fd_pr__cap_mim_m3_1 w=10 l=10
XMN2 vbot rst 0 0 sky130_fd_pr__nfet_05v0_nvt w=2 l=0.9
XC2 vsamp 0 sky130_fd_pr__cap_mim_m3_2 w=4 l=4
Vdd vdd 0 1.8
* @RNL(type="header") {
*   @VERSION("0.3");
*   @USE-PACKAGE(name="rnl-pdk-sky130", version="0.1")
* }
* @RNL {
*   &vdd @ADD-TO $SUPPLY_NET_SET;
*   # @SELECT-INSTANCE(model="sky130_fd_pr__*fet*") => @TEXT("W/L=${w}/${l}", key="model");
*   # @SELECT-INSTANCE(model="sky130_fd_pr__cap_mim_*") => @TEXT("${w}\times{}${l} \mu{}m^{2}", key="value");
*   #XD1 @TEXT("A=${area}", key="value");
*
*   %jin = (-8, 4); %js1 = (2, 4); %js2 = (8, 4); %js3 = (16, 4);
*   &vin @WIRE {#XD1:k %jin};
*   &vin @WIRE(mode="horizontal-vertical") {%jin #XMN1:d};
*   &vin @WIRE(mode="horizontal-vertical") {%jin #XMP1:s};
*   &vsamp @WIRE(mode="vertical-horizontal") {#XMN1:s %js1};
*   &vsamp @WIRE(mode="vertical-horizontal") {#XMP1:d %js1};
*   &vsamp @WIRE {%js1 %js2 %js3};
*   &vsamp @WIRE {%js2 #XC1:c0};
*   &vsamp @WIRE {%js3 #XC2:c0};
*   &vbot @WIRE {#XC1:c1 #XMN2:d};
*   $JUNCTION @ATTACH {%jin %js1 %js2 %js3};
*
*   %p_vin = $IO_PORT @ATTACH &vin;
*   %p_clk = $IO_PORT @ATTACH &clk;
*   %p_clkb = $IO_PORT @ATTACH &clkb;
*   %p_rst = $IO_PORT @ATTACH &rst;
*   $IO_PORT @ATTACH &vsamp => @ORIENT("MY") => %p_out;
*   &vin @WIRE {%p_vin:p %jin};
*   &clk @WIRE {%p_clk:p #XMN1:g};
*   &clkb @WIRE {%p_clkb:p #XMP1:g};
*   &rst @WIRE {%p_rst:p #XMN2:g};
*   &vsamp @WIRE {%js3 %p_out:p}
* }
* @RNL(type="generated", priority="high") {
*   #XD1 @PLACE(-8, 0) => @ORIENT("R90");
*   #XMN1 @PLACE(-2, 1); #XMP1 @PLACE(-2, 7);
*   #XC1 @PLACE(8, 0); #XMN2 @PLACE(8, -6);
*   #XC2 @PLACE(16, 0); #Vdd @PLACE(26, 2);
*   %p_vin @PLACE(-13, 4); %p_clk @PLACE(-7, 1); %p_clkb @PLACE(-7, 7);
*   %p_rst @PLACE(3, -6); %p_out @PLACE(20, 4);
*   %gs_XD1_a = $GROUND_STUB @ATTACH #XD1:a; %gs_XD1_a::g @PLACE(-8, -4);
*   %gs_XMN1_b = $GROUND_STUB @ATTACH #XMN1:b; %gs_XMN1_b::g @PLACE(-1, -2);
*   %gs_XMN2_s = $GROUND_STUB @ATTACH #XMN2:s; %gs_XMN2_s::g @PLACE(8, -10);
*   %gs_XMN2_b = $GROUND_STUB @ATTACH #XMN2:b; %gs_XMN2_b::g @PLACE(9, -9);
*   %gs_XC2_c1 = $GROUND_STUB @ATTACH #XC2:c1; %gs_XC2_c1::g @PLACE(16, -4);
*   %gs_Vdd_n = $GROUND_STUB @ATTACH #Vdd:n; %gs_Vdd_n::g @PLACE(26, -3);
*   %ss_XMP1_b = $SUPPLY_STUB @ATTACH #XMP1:b; %ss_XMP1_b::s @PLACE(-1, 10);
*   %ss_Vdd_p = $SUPPLY_STUB @ATTACH #Vdd:p; %ss_Vdd_p::s @PLACE(26, 7)
* }
.end
