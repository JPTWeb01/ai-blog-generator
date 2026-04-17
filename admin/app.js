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

    // ── Tab state ─────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState( 'generate' );

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

    // ── Taxonomy state ────────────────────────────────────────────────────────
    const [taxonomies,          setTaxonomies]          = useState( { categories: [], tags: [] } );
    const [taxonomiesLoading,   setTaxonomiesLoading]   = useState( false );
    const [selectedCategories,  setSelectedCategories]  = useState( [] );
    const [tagInput,            setTagInput]            = useState( '' );

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

    // ── History state ─────────────────────────────────────────────────────────
    const [history,        setHistory]        = useState( { posts: [], total: 0, pages: 1 } );
    const [historyPage,    setHistoryPage]    = useState( 1 );
    const [historyLoading, setHistoryLoading] = useState( false );
    const [historyLoaded,  setHistoryLoaded]  = useState( false );

    // ── API Key state ─────────────────────────────────────────────────────────
    const [apiKeyStatus,  setApiKeyStatus]  = useState( { configured: false, source: 'none' } );
    const [apiKeyInput,   setApiKeyInput]   = useState( '' );
    const [apiKeyLoading, setApiKeyLoading] = useState( true );
    const [savingApiKey,  setSavingApiKey]  = useState( false );
    const [apiKeySaved,   setApiKeySaved]   = useState( false );
    const [apiKeyError,   setApiKeyError]   = useState( '' );

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

    // ── Load API key status on mount ──────────────────────────────────────────
    useEffect( () => {
        apiFetch( 'api-key' )
            .then( r => r.json() )
            .then( data => setApiKeyStatus( data ) )
            .catch( () => {} )
            .finally( () => setApiKeyLoading( false ) );
    }, [] );

    // ── Load / paginate history when History tab is active ────────────────────
    useEffect( () => {
        if ( activeTab !== 'history' ) return;
        setHistoryLoading( true );
        apiFetch( `history?page=${ historyPage }&per_page=10` )
            .then( r => r.json() )
            .then( data => {
                setHistory( data );
                setHistoryLoaded( true );
            } )
            .catch( () => {} )
            .finally( () => setHistoryLoading( false ) );
    }, [ activeTab, historyPage ] );

    // ── Load taxonomies once a preview is ready (lazy) ────────────────────────
    useEffect( () => {
        if ( ! preview || taxonomies.categories.length > 0 ) return;
        setTaxonomiesLoading( true );
        apiFetch( 'taxonomies' )
            .then( r => r.json() )
            .then( data => setTaxonomies( data ) )
            .catch( () => {} )
            .finally( () => setTaxonomiesLoading( false ) );
    }, [ preview ] );

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
        setSelectedCategories( [] );
        setTagInput( '' );
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
                body:   JSON.stringify( {
                    title:      topic.trim(),
                    content:    preview,
                    status,
                    categories: selectedCategories,
                    tags:       tagInput.trim(),
                    tone,
                    length,
                } ),
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
            // Invalidate history so it reloads fresh on next visit.
            setHistoryLoaded( false );
            setHistoryPage( 1 );
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

    function handleRegenerate( post ) {
        setTopic( post.title );
        if ( post.tone )   setTone( post.tone );
        if ( post.length ) setLength( post.length );
        setPreview( '' );
        setPublishResult( null );
        setActiveTab( 'generate' );
    }

    async function handleSaveApiKey( e ) {
        e.preventDefault();
        setSavingApiKey( true );
        setApiKeyError( '' );
        setApiKeySaved( false );

        try {
            const res = await apiFetch( 'api-key', {
                method: 'POST',
                body:   JSON.stringify( { api_key: apiKeyInput.trim() } ),
            } );

            if ( ! res.ok ) {
                const data = await res.json().catch( () => ( {} ) );
                throw new Error( data?.message ?? `Server error ${ res.status }` );
            }

            const data = await res.json();
            setApiKeyStatus( data );
            setApiKeyInput( '' );
            setApiKeySaved( true );
            setTimeout( () => setApiKeySaved( false ), 3000 );
        } catch ( err ) {
            setApiKeyError( err.message || 'Could not save the API key. Please try again.' );
        } finally {
            setSavingApiKey( false );
        }
    }

    const isBusy = loading || publishingAs !== null;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="ai-blog-plugin-wrap">

            {/* ── Tab Navigation ───────────────────────────────── */}
            <nav className="aibg-tabs" role="tablist">
                { [
                    { id: 'generate', label: 'Generate' },
                    { id: 'history',  label: 'History'  },
                    { id: 'autopost', label: 'Auto-Post' },
                    { id: 'apikey',   label: 'API Key'   },
                ].map( tab => (
                    <button
                        key={ tab.id }
                        role="tab"
                        aria-selected={ activeTab === tab.id }
                        className={ `aibg-tab${ activeTab === tab.id ? ' aibg-tab--active' : '' }` }
                        onClick={ () => setActiveTab( tab.id ) }
                    >
                        { tab.label }
                        { tab.id === 'apikey' && ! apiKeyLoading && ! apiKeyStatus.configured && (
                            <span className="aibg-tab__badge" title="API key not configured">!</span>
                        ) }
                    </button>
                ) ) }
            </nav>

            {/* ── Generate Tab ─────────────────────────────────── */}
            { activeTab === 'generate' && (
                <div role="tabpanel">
                    { ! apiKeyStatus.configured && ! apiKeyLoading && (
                        <div className="aibg-notice aibg-notice--warning">
                            No Gemini API key configured.{ ' ' }
                            <button className="aibg-notice__link" onClick={ () => setActiveTab( 'apikey' ) }>
                                Add your API key
                            </button>{ ' ' }
                            to start generating posts.
                        </div>
                    ) }

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

                    {/* ── Preview card ──────────────────────────── */}
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

                    {/* ── Category & Tag picker ────────────────── */}
                    { preview && ! publishResult && (
                        <div className="aibg-taxonomy">
                            <h3 className="aibg-taxonomy__heading">Categories &amp; Tags</h3>

                            { taxonomiesLoading ? (
                                <div className="aibg-skeleton" aria-busy="true" aria-label="Loading categories">
                                    <div className="aibg-skeleton__line aibg-skeleton__line--wide" />
                                    <div className="aibg-skeleton__line aibg-skeleton__line--short" />
                                </div>
                            ) : (
                                <div className="aibg-taxonomy__fields">
                                    { taxonomies.categories.length > 0 && (
                                        <div className="aibg-field">
                                            <span className="aibg-label">Categories</span>
                                            <div className="aibg-checklist">
                                                { taxonomies.categories.map( cat => (
                                                    <label key={ cat.id } className="aibg-checklist__item">
                                                        <input
                                                            type="checkbox"
                                                            checked={ selectedCategories.includes( cat.id ) }
                                                            onChange={ e => {
                                                                setSelectedCategories( prev =>
                                                                    e.target.checked
                                                                        ? [ ...prev, cat.id ]
                                                                        : prev.filter( id => id !== cat.id )
                                                                );
                                                            } }
                                                            disabled={ publishingAs !== null }
                                                        />
                                                        <span className={ cat.parent ? 'aibg-checklist__child' : '' }>
                                                            { cat.name }
                                                        </span>
                                                    </label>
                                                ) ) }
                                            </div>
                                        </div>
                                    ) }

                                    <div className="aibg-field">
                                        <label htmlFor="aibg-tags" className="aibg-label">Tags</label>
                                        <input
                                            id="aibg-tags"
                                            type="text"
                                            className="aibg-input"
                                            placeholder="e.g. wordpress, AI, blogging"
                                            value={ tagInput }
                                            onChange={ e => setTagInput( e.target.value ) }
                                            disabled={ publishingAs !== null }
                                        />
                                        <p className="aibg-field__hint">Separate tags with commas. New tags are created automatically.</p>
                                    </div>
                                </div>
                            ) }
                        </div>
                    ) }

                    {/* ── Publish actions ───────────────────────── */}
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

                    {/* ── Publish success banner ────────────────── */}
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
                </div>
            ) }

            {/* ── History Tab ─────────────────────────────────── */}
            { activeTab === 'history' && (
                <div role="tabpanel">
                    { historyLoading && ! historyLoaded ? (
                        <div className="aibg-skeleton" aria-busy="true" aria-label="Loading history">
                            { [ 1, 2, 3 ].map( i => (
                                <div key={ i } className="aibg-skeleton__row">
                                    <div className="aibg-skeleton__line aibg-skeleton__line--wide" />
                                    <div className="aibg-skeleton__line aibg-skeleton__line--short" />
                                </div>
                            ) ) }
                        </div>
                    ) : history.posts.length === 0 ? (
                        <div className="aibg-history-empty">
                            <p>No AI-generated posts yet. Generate and publish your first post to see it here.</p>
                            <button className="aibg-btn" onClick={ () => setActiveTab( 'generate' ) }>
                                Generate a Post
                            </button>
                        </div>
                    ) : (
                        <>
                            <table className="aibg-history-table">
                                <thead>
                                    <tr>
                                        <th>Title</th>
                                        <th>Date</th>
                                        <th>Status</th>
                                        <th>Tone</th>
                                        <th>Length</th>
                                        <th>Words</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    { history.posts.map( post => (
                                        <tr key={ post.id }>
                                            <td className="aibg-history-table__title">
                                                <a href={ post.edit_url } target="_blank" rel="noreferrer">
                                                    { post.title || '(no title)' }
                                                </a>
                                            </td>
                                            <td className="aibg-history-table__date">{ post.date }</td>
                                            <td>
                                                <span className={ `aibg-status aibg-status--${ post.status }` }>
                                                    { post.status === 'publish' ? 'Published' : 'Draft' }
                                                </span>
                                            </td>
                                            <td className="aibg-history-table__meta">
                                                { post.tone || '—' }
                                            </td>
                                            <td className="aibg-history-table__meta">
                                                { post.length || '—' }
                                            </td>
                                            <td className="aibg-history-table__meta">
                                                { post.word_count.toLocaleString() }
                                            </td>
                                            <td className="aibg-history-table__actions">
                                                <a href={ post.edit_url } target="_blank" rel="noreferrer" className="aibg-history-action">
                                                    Edit
                                                </a>
                                                { post.status === 'publish' && (
                                                    <a href={ post.view_url } target="_blank" rel="noreferrer" className="aibg-history-action">
                                                        View
                                                    </a>
                                                ) }
                                                <button
                                                    className="aibg-history-action aibg-history-action--regen"
                                                    onClick={ () => handleRegenerate( post ) }
                                                >
                                                    Regenerate
                                                </button>
                                            </td>
                                        </tr>
                                    ) ) }
                                </tbody>
                            </table>

                            { history.pages > 1 && (
                                <div className="aibg-pagination">
                                    <button
                                        className="aibg-btn aibg-btn--secondary aibg-btn--sm"
                                        disabled={ historyPage <= 1 || historyLoading }
                                        onClick={ () => setHistoryPage( p => p - 1 ) }
                                    >
                                        &larr; Previous
                                    </button>
                                    <span className="aibg-pagination__info">
                                        Page { historyPage } of { history.pages }
                                    </span>
                                    <button
                                        className="aibg-btn aibg-btn--secondary aibg-btn--sm"
                                        disabled={ historyPage >= history.pages || historyLoading }
                                        onClick={ () => setHistoryPage( p => p + 1 ) }
                                    >
                                        Next &rarr;
                                    </button>
                                </div>
                            ) }
                        </>
                    ) }
                </div>
            ) }

            {/* ── Auto-Post Tab ────────────────────────────────── */}
            { activeTab === 'autopost' && (
                <div role="tabpanel" className="aibg-settings">
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
            ) }

            {/* ── API Key Tab ──────────────────────────────────── */}
            { activeTab === 'apikey' && (
                <div role="tabpanel" className="aibg-settings">
                    <p className="aibg-settings__description">
                        Enter your Google Gemini API key. The key is stored securely in the WordPress database and is never exposed to the browser.
                    </p>

                    { apiKeyLoading ? (
                        <div className="aibg-skeleton" aria-busy="true" aria-label="Loading API key status">
                            <div className="aibg-skeleton__line aibg-skeleton__line--wide"  />
                            <div className="aibg-skeleton__line aibg-skeleton__line--short" />
                        </div>
                    ) : (
                        <>
                            <div className={ `aibg-api-key-status aibg-api-key-status--${ apiKeyStatus.configured ? 'ok' : 'missing' }` }>
                                { apiKeyStatus.source === 'constant' && (
                                    <>API key set via <code>GEMINI_API_KEY</code> constant in <code>wp-config.php</code>. Remove the constant to manage it here.</>
                                ) }
                                { apiKeyStatus.source === 'database' && (
                                    <>API key is configured. Enter a new key below to replace it.</>
                                ) }
                                { apiKeyStatus.source === 'none' && (
                                    <>No API key configured. The plugin cannot generate posts until a key is added.</>
                                ) }
                            </div>

                            { apiKeyStatus.source !== 'constant' && (
                                <form className="aibg-form" onSubmit={ handleSaveApiKey } noValidate>
                                    <div className="aibg-field">
                                        <label htmlFor="aibg-api-key" className="aibg-label">
                                            Gemini API Key
                                        </label>
                                        <input
                                            id="aibg-api-key"
                                            type="password"
                                            className="aibg-input aibg-input--mono"
                                            placeholder="AIza…"
                                            value={ apiKeyInput }
                                            onChange={ e => setApiKeyInput( e.target.value ) }
                                            disabled={ savingApiKey }
                                            autoComplete="off"
                                        />
                                        <p className="aibg-field__hint">
                                            Leave blank and save to remove the stored key.
                                        </p>
                                    </div>

                                    { apiKeyError && (
                                        <p className="aibg-error" role="alert">
                                            { apiKeyError }
                                        </p>
                                    ) }

                                    { apiKeySaved && (
                                        <p className="aibg-success-inline" role="status">
                                            API key saved.
                                        </p>
                                    ) }

                                    <button
                                        type="submit"
                                        className={ `aibg-btn${ savingApiKey ? ' aibg-btn--loading' : '' }` }
                                        disabled={ savingApiKey }
                                    >
                                        { savingApiKey ? 'Saving…' : 'Save API Key' }
                                    </button>
                                </form>
                            ) }
                        </>
                    ) }
                </div>
            ) }

        </div>
    );
}

// ── Mount ─────────────────────────────────────────────────────────────────────

const container = document.getElementById( 'ai-blog-root' );
if ( container ) {
    createRoot( container ).render( <App /> );
}
