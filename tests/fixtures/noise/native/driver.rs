pub async fn click(client: &Client) -> Result<()> {
    client.invoke("click", serde_json::json!({})).await?;
    Ok(())
}
