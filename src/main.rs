use axum::{routing::get, Json, Router};
use serde::Serialize;

#[derive(Serialize)]
struct Hello {
    message: String,
}

async fn root() -> Json<Hello> {
    Json(Hello {
        message: format!("Hello from tovyr — starter Rust web server"),
    })
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/", get(root));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080")
        .await
        .expect("bind 127.0.0.1:8080");
    println!("listening on http://127.0.0.1:8080");
    axum::serve(listener, app).await.expect("serve");
}
