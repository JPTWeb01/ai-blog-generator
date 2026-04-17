import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import './styles.css';

const TONES = [
    { value: 'professional', label: 'Professional' },
    { value: 'casual',       label: 'Casual'       },
    { value: 'beginner',     label: 'Beginner'      },
];

const LENGTHS = [
    { value: 'short',  label: 'Short  (~300 words)'  },
    { value: 'medium', label: 'Medium (~600 words)'  },
    { value: 'long',   label: 'Long   (~1200 words)' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function apiFetch( path, options = {} ) {
    const { restUrl, nonce } = window.aiBlogData ?? {};
    return fetch( `${ restUrl }${ path }`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce':   nonce,
            ...( options.headers ?? {} ),
        },
    } );
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {

    // ── Generate state ────────────────────────────────────────────────────────
    const [topic,         setTopic]         = useState( '' );
    const [tone,          setTone]          = useState( 'professional' );
    const [length,        setLength]        = useState( 'medium' );
    const [preview,       setPreview]       = useState( '' );
    const [loading,       setLoading]       = useState( false );
    const [error,         setError]         = useState( '' );

    // ── Publish state ─────────────────────────────────────────────────────────
    const [publishingAs,  setPublishingAs]  = useState( null );
    const [publishError,  setPublishError]  = useState( '' );
    const [publishResult, setPublishResult] = useState( null );

    // ── Settings state ────────────────────────────────────────────────────────
    const [settings, setSettings] = useState( {
        enabled: false,
        topic:   '',
        tone:    'professional',
        length:  'medium',
    } );
    const [nextRun,         setNextRun]         = useState( '' );
    const [settingsLoading, setSettingsLoading] = useState( true );
    const [savingSettings,  setSavingSettings]  = useState( false );
    const [settingsError,   setSettingsError]   = useState( '' );
    const [settingsSaved,   setSettingsSaved]   = useState( false );

    // ── Load settings on mount ────────────────────────────────────────────────
    useEffect( () => {
        apiFetch( 'settings' )
            .then( r => r.json() )
            .then( data => {
                setSettings( {
                    enabled: data.enabled ?? false,
                    topic:   data.topic   ?? '',
                    tone:    data.tone    ?? 'professional',
                    length:  data.length  ?? 'medium',
                } );
                setNextRun( data.next_run ?? '' );
            } )
            .catch( () => {} )
            .finally( () => setSettingsLoading( false ) );
    }, [] );

    // ── Handlers ──────────────────────────────────────────────────────────────

    async function handleGenerate( e ) {
        e.preventDefault();

        const trimmed = topic.trim();
        if ( ! trimmed ) {
            setError( 'Please enter a blog topic.' );
            return;
        }

        setError( '' );
        setPreview( '' );
        setPublishError( '' );
        setPublishResult( null );
        setLoading( true );

        try {
            const res = await apiFetch( 'generate', {
                method: 'POST',
                body:   JSON.stringify( { topic: trimmed, tone, length } ),
            } );

            if ( ! res.ok ) {
                const data = await res.json().catch( () => ( {} ) );
                throw new Error( data?.message ?? `Server error ${ res.status }` );
            }

            const data = await res.json();
            setPreview( data?.content ?? '' );
        } catch ( err ) {
            setError( err.message || 'Something went wrong. Please try again.' );
        } finally {
            setLoading( false );
        }
    }

    async function handlePublish( status ) {
        setPublishingAs( status );
        setPublishError( '' );

        try {
            const res = await apiFetch( 'publish', {
                method: 'POST',
                body:   JSON.stringify( { title: topic.trim(), content: preview, status } ),
            } );

            if ( ! res.ok ) {
                const data = await res.json().catch( () => ( {} ) );
                throw new Error( data?.message ?? `Server error ${ res.status }` );
            }

            const data = await res.json();
            setPublishResult( {
                postId:  data.post_id,
                editUrl: data.edit_url,
                viewUrl: data.view_url,
                status:  data.status,
            } );
        } catch ( err ) {
            setPublishError( err.message || 'Could not save the post. Please try again.' );
        } finally {
            setPublishingAs( null );
        }
    }

    async function handleSaveSettings( e ) {
        e.preventDefault();
        setSavingSettings( true );
        setSettingsError( '' );
        setSettingsSaved( false );

        try {
            const res = await apiFetch( 'settings', {
                method: 'POST',
                body:   JSON.stringify( settings ),
            } );

            if ( ! res.ok ) {
                const data = await res.json().catch( () => ( {} ) );
                throw new Error( data?.message ?? `Server error ${ res.status }` );
            }

            const data = await res.json();
            setNextRun( data.next_run ?? '' );
            setSettingsSaved( true );
            setTimeout( () => setSettingsSaved( false ), 3000 );
        } catch ( err ) {
            setSettingsError( err.message || 'Could not save settings. Please try again.' );
        } finally {
            setSavingSettings( false );
        }
    }

    const isBusy = loading || publishingAs !== null;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="ai-blog-plugin-wrap">

            {/* ── Generation form ──────────────────────────────── */}
            <form className="aibg-form" onSubmit={ handleGenerate } noValidate>
                <div className="aibg-field">
                    <label htmlFor="aibg-topic" className="aibg-label">
                        Blog Topic
                    </label>
                    <input
                        id="aibg-topic"
                        type="text"
                        className="aibg-input"
                        placeholder="e.g. The future of renewable energy"
                        value={ topic }
                        onChange={ e => setTopic( e.target.value ) }
                        disabled={ isBusy }
                        required
                    />
                </div>

                <div className="aibg-row">
                    <div className="aibg-field">
                        <label htmlFor="aibg-tone" className="aibg-label">
                            Tone
                        </label>
                        <select
                            id="aibg-tone"
                            className="aibg-select"
                            value={ tone }
                            onChange={ e => setTone( e.target.value ) }
                            disabled={ isBusy }
                        >
                            { TONES.map( t => (
                                <option key={ t.value } value={ t.value }>
                                    { t.label }
                                </option>
                            ) ) }
                        </select>
                    </div>

                    <div className="aibg-field">
                        <label htmlFor="aibg-length" className="aibg-label">
                            Length
                        </label>
                        <select
                            id="aibg-length"
                            className="aibg-select"
                            value={ length }
                            onChange={ e => setLength( e.target.value ) }
                            disabled={ isBusy }
                        >
                            { LENGTHS.map( l => (
                                <option key={ l.value } value={ l.value }>
                                    { l.label }
                                </option>
                            ) ) }
                        </select>
                    </div>
                </div>

                { error && (
                    <p className="aibg-error" role="alert">
                        { error }
                    </p>
                ) }

                <button
                    type="submit"
                    className={ `aibg-btn${ loading ? ' aibg-btn--loading' : '' }` }
                    disabled={ isBusy }
                >
                    { loading ? 'Generating…' : 'Generate Blog' }
                </button>
            </form>

            {/* ── Preview card ─────────────────────────────────── */}
            { ( loading || preview ) && (
                <div className="aibg-preview">
                    <h2 className="aibg-preview__heading">Preview</h2>
                    { loading ? (
                        <div className="aibg-skeleton" aria-busy="true" aria-label="Loading preview">
                            <div className="aibg-skeleton__line aibg-skeleton__line--wide"  />
                            <div className="aibg-skeleton__line"                            />
                            <div className="aibg-skeleton__line aibg-skeleton__line--short" />
                            <div className="aibg-skeleton__line"                            />
                            <div className="aibg-skeleton__line aibg-skeleton__line--wide"  />
                        </div>
                    ) : (
                        <div
                            className="aibg-preview__content"
                            dangerouslySetInnerHTML={ { __html: preview } }
                        />
                    ) }
                </div>
            ) }

            {/* ── Publish actions (shown once preview is ready) ─ */}
            { preview && ! publishResult && (
                <div className="aibg-actions">
                    { publishError && (
                        <p className="aibg-error" role="alert">
                            { publishError }
                        </p>
                    ) }
                    <div className="aibg-actions__buttons">
                        <button
                            type="button"
                            className={ `aibg-btn aibg-btn--secondary${ publishingAs === 'draft' ? ' aibg-btn--loading' : '' }` }
                            onClick={ () => handlePublish( 'draft' ) }
                            disabled={ publishingAs !== null }
                        >
                            { publishingAs === 'draft' ? 'Saving…' : 'Save as Draft' }
                        </button>
                        <button
                            type="button"
                            className={ `aibg-btn aibg-btn--publish${ publishingAs === 'publish' ? ' aibg-btn--loading' : '' }` }
                            onClick={ () => handlePublish( 'publish' ) }
                            disabled={ publishingAs !== null }
                        >
                            { publishingAs === 'publish' ? 'Publishing…' : 'Publish Now' }
                        </button>
                    </div>
                </div>
            ) }

            {/* ── Publish success banner ───────────────────────── */}
            { publishResult && (
                <div className="aibg-success" role="status">
                    <p className="aibg-success__message">
                        { publishResult.status === 'publish'
                            ? 'Post published successfully!'
                            : 'Post saved as draft!' }
                    </p>
                    <div className="aibg-success__links">
                        <a
                            href={ publishResult.editUrl }
                            className="aibg-success__link"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Edit post
                        </a>
                        { publishResult.status === 'publish' && (
                            <a
                                href={ publishResult.viewUrl }
                                className="aibg-success__link"
                                target="_blank"
                                rel="noreferrer"
                            >
                                View post
                            </a>
                        ) }
                    </div>
                </div>
            ) }

            {/* ── Auto-Post Settings ───────────────────────────── */}
            <div className="aibg-settings">
                <h2 className="aibg-settings__heading">Auto-Post Settings</h2>
                <p className="aibg-settings__description">
                    When enabled, a new blog post will be generated and published automatically once per day using WP-Cron.
                </p>

                { settingsLoading ? (
                    <div className="aibg-skeleton" aria-busy="true" aria-label="Loading settings">
                        <div className="aibg-skeleton__line aibg-skeleton__line--wide"  />
                        <div className="aibg-skeleton__line aibg-skeleton__line--short" />
                    </div>
                ) : (
                    <form className="aibg-form aibg-form--settings" onSubmit={ handleSaveSettings } noValidate>

                        {/* Enable toggle */}
                        <label className="aibg-toggle">
                            <input
                                type="checkbox"
                                className="aibg-toggle__checkbox"
                                checked={ settings.enabled }
                                onChange={ e => setSettings( s => ( { ...s, enabled: e.target.checked } ) ) }
                                disabled={ savingSettings }
                            />
                            <span className="aibg-toggle__track" aria-hidden="true">
                                <span className="aibg-toggle__thumb" />
                            </span>
                            <span className="aibg-toggle__label">
                                { settings.enabled ? 'Daily auto-posting enabled' : 'Daily auto-posting disabled' }
                            </span>
                        </label>

                        { settings.enabled && (
                            <>
                                <div className="aibg-field">
                                    <label htmlFor="aibg-auto-topic" className="aibg-label">
                                        Auto-Post Topic
                                    </label>
                                    <input
                                        id="aibg-auto-topic"
                                        type="text"
                                        className="aibg-input"
                                        placeholder="e.g. Tips for small business owners"
                                        value={ settings.topic }
                                        onChange={ e => setSettings( s => ( { ...s, topic: e.target.value } ) ) }
                                        disabled={ savingSettings }
                                    />
                                </div>

                                <div className="aibg-row">
                                    <div className="aibg-field">
                                        <label htmlFor="aibg-auto-tone" className="aibg-label">
                                            Tone
                                        </label>
                                        <select
                                            id="aibg-auto-tone"
                                            className="aibg-select"
                                            value={ settings.tone }
                                            onChange={ e => setSettings( s => ( { ...s, tone: e.target.value } ) ) }
                                            disabled={ savingSettings }
                                        >
                                            { TONES.map( t => (
                                                <option key={ t.value } value={ t.value }>
                                                    { t.label }
                                                </option>
                                            ) ) }
                                        </select>
                                    </div>

                                    <div className="aibg-field">
                                        <label htmlFor="aibg-auto-length" className="aibg-label">
                                            Length
                                        </label>
                                        <select
                                            id="aibg-auto-length"
                                            className="aibg-select"
                                            value={ settings.length }
                                            onChange={ e => setSettings( s => ( { ...s, length: e.target.value } ) ) }
                                            disabled={ savingSettings }
                                        >
                                            { LENGTHS.map( l => (
                                                <option key={ l.value } value={ l.value }>
                                                    { l.label }
                                                </option>
                                            ) ) }
                                        </select>
                                    </div>
                                </div>

                                { nextRun && (
                                    <p className="aibg-settings__next-run">
                                        Next scheduled run: <strong>{ nextRun }</strong>
                                    </p>
                                ) }
                            </>
                        ) }

                        { settingsError && (
                            <p className="aibg-error" role="alert">
                                { settingsError }
                            </p>
                        ) }

                        { settingsSaved && (
                            <p className="aibg-success-inline" role="status">
                                Settings saved.
                            </p>
                        ) }

                        <button
                            type="submit"
                            className={ `aibg-btn${ savingSettings ? ' aibg-btn--loading' : '' }` }
                            disabled={ savingSettings }
                        >
                            { savingSettings ? 'Saving…' : 'Save Settings' }
                        </button>
                    </form>
                ) }
            </div>

        </div>
    );
}

// ── Mount ─────────────────────────────────────────────────────────────────────

const container = document.getElementById( 'ai-blog-root' );
if ( container ) {
    createRoot( container ).render( <App /> );
}
