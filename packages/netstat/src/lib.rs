use napi::bindgen_prelude::{Array, External};
use napi_derive::napi;
use netstat2::*;
use network_interface::{NetworkInterface, NetworkInterfaceConfig};

#[napi]
pub fn debug_socket_info() {
  let af_flags = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
  let proto_flags = ProtocolFlags::TCP | ProtocolFlags::UDP;
  let sockets_info = get_sockets_info(af_flags, proto_flags).unwrap();

  for si in sockets_info {
    match si.protocol_socket_info {
      ProtocolSocketInfo::Tcp(tcp_si) => println!(
        "TCP {}:{} -> {}:{} {:?} - {}",
        tcp_si.local_addr,
        tcp_si.local_port,
        tcp_si.remote_addr,
        tcp_si.remote_port,
        si.associated_pids,
        tcp_si.state
      ),
      ProtocolSocketInfo::Udp(udp_si) => println!(
        "UDP {}:{} -> *:* {:?}",
        udp_si.local_addr, udp_si.local_port, si.associated_pids
      ),
    }
  }
}

#[napi]
pub fn get_network_interface() -> External<Array> {
  let interfaces = NetworkInterface::show().unwrap();

  External::new(Array::from_vec(env, interfaces).expect("failed"))
}
