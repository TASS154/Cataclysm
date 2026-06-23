import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="map-view map-view--error map-view--embedded">
          <p>Algo deu errado ao carregar esta tela.</p>
          <p className="muted small">{this.state.error?.message || String(this.state.error)}</p>
          {this.props.onReset ? (
            <button type="button" className="btn-primary" onClick={() => {
              this.setState({ error: null });
              this.props.onReset();
            }}>
              Tentar novamente
            </button>
          ) : null}
          {this.props.fallback}
        </div>
      );
    }
    return this.props.children;
  }
}
