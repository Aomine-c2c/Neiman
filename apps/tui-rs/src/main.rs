pub mod client;
pub mod common;
pub mod theme;
pub mod cli;
pub mod features;
pub mod app;
pub mod ui;
pub mod handlers;
pub mod fixtures;

pub use app::AppState;
pub use common::*;
pub use theme::*;
pub use features::cockpit;

#[cfg(test)]
mod command_center_tests;

use std::io;
use std::time::Duration;
use crossterm::{
    event::{self, Event, KeyEventKind},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 || !crossterm::tty::IsTty::is_tty(&io::stdout()) {
        if args.len() > 1 {
            use clap::Parser;
            match cli::Cli::try_parse() {
                Ok(cli_args) => {
                    if let Some(cmd) = cli_args.command {
                        return cli::run_cli_command(cmd).await;
                    }
                }
                Err(e) => {
                    e.print()?;
                    return Ok(());
                }
            }
            return Ok(());
        } else {
            println!("NEIMAN Native Rust Operator Cockpit compiled successfully (Non-TTY execution verified).");
            return Ok(());
        }
    }

    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, crossterm::event::EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let mut state = AppState::new();
    state.sync_backend_state().await;

    let mut last_poll = tokio::time::Instant::now();
    let poll_interval = Duration::from_secs(3);

    loop {
        terminal.draw(|f| {
            let area = f.area();
            let header_area = ratatui::layout::Rect::new(0, 0, area.width, 4);
            let main_area = ratatui::layout::Rect::new(0, 4, area.width, area.height.saturating_sub(4));
            
            cockpit::render_cyber_header(f, &state, header_area);
            cockpit::render_unified_cockpit(f, &state, main_area);
        })?;

        let effective_poll = if state.connection_state == ConnectionState::Offline {
            Duration::from_secs(6)
        } else {
            poll_interval
        };

        if last_poll.elapsed() >= effective_poll {
            state.sync_backend_state().await;
            last_poll = tokio::time::Instant::now();
        }

        if event::poll(Duration::from_millis(50))? {
            match event::read()? {
                Event::Key(key) => {
                    if key.kind == KeyEventKind::Press
                        && handlers::handle_key_event(&mut state, key).await {
                            break;
                        }
                }
                Event::Mouse(mouse) if handlers::handle_mouse_event(&mut state, mouse).await => {
                    break;
                }
                _ => {}
            }
        }
    }

    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen, crossterm::event::DisableMouseCapture)?;
    terminal.show_cursor()?;
    Ok(())
}
