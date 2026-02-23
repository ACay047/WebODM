import '../css/ImportExternalPanel.scss';
import React from 'react';
import PropTypes from 'prop-types';
import Dropzone from '../vendor/dropzone';
import csrf from '../django/csrf';
import ErrorMessage from './ErrorMessage';
import UploadProgressBar from './UploadProgressBar';
import { _, interpolate } from '../classes/gettext';
import Trans from './Trans';

class ImportExternalPanel extends React.Component {
  static defaultProps = {
  };

  static propTypes = {
      onImported: PropTypes.func.isRequired,
      onCancel: PropTypes.func,
      projectId: PropTypes.number.isRequired
  };

  constructor(props){
    super(props);

    this.state = {
      error: "",
      uploading: false,
      importingFromUrl: false,
      progress: 0,
      bytesSent: 0,
    };
  }

  defaultTaskName = () => {
    return `Task of ${new Date().toISOString()}`;
  }

  componentDidMount(){
    Dropzone.autoDiscover = false;

    if (this.dropzone){
      this.dz = new Dropzone(this.dropzone, {
          paramName: "file",
          url : `/api/projects/${this.props.projectId}/tasks/import`,
          parallelUploads: 1,
          maxFilesize: 2147483647,
          uploadMultiple: false,
          acceptedFiles: "application/zip,application/octet-stream,application/x-zip-compressed,multipart/x-zip",
          autoProcessQueue: true,
          createImageThumbnails: false,
          previewTemplate: '<div style="display:none"></div>',
          clickable: this.uploadButton,
          timeout: 2147483647,
          chunking: true,
          chunkSize: 8000000, // 8MB,
          retryChunks: true,
          retryChunksLimit: 20,
          headers: {
            [csrf.header]: csrf.token
          }
      });

      this.dz.on("error", (file) => {
          if (this.state.uploading) this.setState({error: _("Cannot upload file. Check your internet connection and try again.")});
        })
        .on("sending", () => {
          this.setState({typeUrl: false, uploading: true, totalCount: 1});
        })
        .on("reset", () => {
          this.setState({uploading: false, progress: 0, totalBytes: 0, totalBytesSent: 0});
        })
        .on("uploadprogress", (file, progress, bytesSent) => {
            if (progress == 100) return; // Workaround for chunked upload progress bar jumping around
            this.setState({
              progress,
              totalBytes: file.size,
              totalBytesSent: bytesSent
            });
        })
        .on("sending", (file, xhr, formData) => {
          // Safari does not have support for has on FormData
          // as of December 2017
          if (!formData.has || !formData.has("name")) formData.append("name", this.defaultTaskName());
        })
        .on("complete", (file) => {
          if (file.status === "success"){
            this.setState({uploading: false});
            try{
              let response = JSON.parse(file.xhr.response);
              if (!response.id) throw new Error(`Expected id field, but none given (${response})`);
              this.props.onImported();
            }catch(e){
              this.setState({error: interpolate(_('Invalid response from server: %(error)s'), { error: e.message})});
            }
          }else{
            this.setState({uploading: false, error: _("An error occured while uploading the file. Please try again.")});
          }
        });
    }
  }

  cancel = (e) => {
    this.cancelUpload();
    this.props.onCancel();
  }

  cancelUpload = (e) => {
    this.setState({uploading: false});
    setTimeout(() => {
      this.dz.removeAllFiles(true);
    }, 0);
  }

  setRef = (prop) => {
    return (domNode) => {
      if (domNode != null) this[prop] = domNode;
    }
  }

  render() {
    return (
      <div ref={this.setRef("dropzone")} className="import-external-panel theme-background-highlight">
        <div className="form-horizontal">
          <ErrorMessage bind={[this, 'error']} />

          <button type="button" className="close theme-color-primary" title="Close" onClick={this.cancel}><span aria-hidden="true">&times;</span></button>
          <h4>{_("Import External Data")}</h4>
          
          <button disabled={this.state.uploading}
                  type="button" 
                  className="btn btn-primary"
                  ref={this.setRef("uploadButton")}>
            <i className="glyphicon glyphicon-upload"></i>
            {_("Upload")}
          </button>

          {this.state.uploading ? <div>
            <UploadProgressBar {...this.state}/>
            <button type="button"
                    className="btn btn-danger btn-sm" 
                    onClick={this.cancelUpload}>
              <i className="glyphicon glyphicon-remove-circle"></i>
              {_("Cancel Upload")}
            </button> 
          </div> : ""}
        </div>
      </div>
    );
  }
}

export default ImportExternalPanel;
