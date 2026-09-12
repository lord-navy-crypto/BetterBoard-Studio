mod labbridge_native_watch;
mod labbridge_v1;

fn main() {
    labbridge_native_watch::spawn_native_exporter();
    betterboard_studio_lib::run();
}
