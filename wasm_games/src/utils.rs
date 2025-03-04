use wasm_bindgen::prelude::*;
use web_sys::{window, Document};

pub fn set_panic_hook() {
    console_error_panic_hook::set_once();
}

pub fn show_message(msg: &str) {
    let window = window().unwrap();
    let document = window.document().unwrap();
    let body = document.body().unwrap();

    let message = document.create_element("p").unwrap();
    message.set_inner_html(msg);
    body.append_child(&message).unwrap();
}
